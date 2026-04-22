"""
Stitch Flow — Input Sharing API Routes

REST endpoints for config/status and WebSocket bridge for real-time
input event relay between desktop daemon and Android phone.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel
from typing import Optional
import asyncio
import json
import time

from services.input_sharing import daemon

router = APIRouter()

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class ToggleRequest(BaseModel):
    enabled: bool

class SettingsUpdate(BaseModel):
    cursor_speed_multiplier: Optional[float] = None
    edge_threshold_px: Optional[int] = None
    edge_dwell_ms: Optional[int] = None
    enabled: Optional[bool] = None

class EdgeUpdate(BaseModel):
    device_id: str
    edge: str

class UnpairRequest(BaseModel):
    device_id: str

# ---------------------------------------------------------------------------
# REST Endpoints
# ---------------------------------------------------------------------------

@router.get("/status")
def get_status():
    """Get current input sharing status and device list."""
    return daemon.get_status()


@router.post("/toggle")
def toggle_sharing(req: ToggleRequest):
    """Enable or disable input sharing."""
    daemon.update_settings(enabled=req.enabled)
    return {"success": True, "enabled": req.enabled}


@router.post("/settings")
def update_settings(req: SettingsUpdate):
    """Update input sharing settings."""
    daemon.update_settings(
        speed=req.cursor_speed_multiplier,
        threshold=req.edge_threshold_px,
        dwell=req.edge_dwell_ms,
        enabled=req.enabled,
    )
    return {"success": True, "config": daemon.get_status()["config"]}


@router.post("/edge")
def update_edge(req: EdgeUpdate):
    """Update which edge a device is assigned to."""
    if req.edge not in ("right", "left", "top", "bottom"):
        raise HTTPException(status_code=400, detail="Invalid edge. Use: right, left, top, bottom")
    success = daemon.update_device_edge(req.device_id, req.edge)
    if not success:
        raise HTTPException(status_code=404, detail="Device not found")
    return {"success": True}


@router.get("/devices")
def list_devices():
    """List all paired devices."""
    return {
        "devices": [
            {
                "name": d.name,
                "device_id": d.device_id,
                "edge": d.edge,
                "paired": d.paired,
                "phone_size": [d.phone_width, d.phone_height],
            }
            for d in daemon.config.devices
        ]
    }


@router.post("/pair/generate")
def generate_pairing_otp():
    """Generate a 6-digit OTP for device pairing."""
    otp = daemon.pairing.generate_otp()
    return {"otp": otp, "expires_in": daemon.pairing.OTP_EXPIRY_SECONDS}


@router.post("/unpair")
def unpair_device(req: UnpairRequest):
    """Remove a paired device."""
    daemon.unpair_device(req.device_id)
    return {"success": True}


@router.post("/return-to-desktop")
def force_return():
    """Force cursor back to desktop (emergency)."""
    daemon.transition_to_desktop()
    return {"success": True}


# ---------------------------------------------------------------------------
# WebSocket: Input Event Bridge (Phone connects here)
# ---------------------------------------------------------------------------

# Track connected phone WebSocket
_phone_bridge_ws: Optional[WebSocket] = None


@router.websocket("/ws/bridge")
async def input_bridge_ws(websocket: WebSocket):
    """
    The phone connects here to receive input events and send back responses.

    Protocol:
    Desktop → Phone (input events):
        {"t":"m","dx":5,"dy":-2,"x":540,"y":960}  — mouse move
        {"t":"cd","b":"l","x":540,"y":960}         — click down
        {"t":"cu","b":"l","x":540,"y":960}         — click up
        {"t":"s","dx":0,"dy":-3,"x":540,"y":960}   — scroll
        {"t":"kd","k":"a"}                         — key down
        {"t":"ku","k":"a"}                         — key up
        {"t":"transition","to":"phone",...}         — cursor transition
        {"t":"transition","to":"desktop"}           — return to desktop

    Phone → Desktop:
        {"t":"paired","name":"Phone","w":1080,"h":2400,"device_id":"..."}
        {"t":"verify_otp","otp":"123456","name":"Phone","w":1080,"h":2400}
        {"t":"return"}                             — cursor return requested
        {"t":"dimensions","w":1080,"h":2400}       — screen size update
    """
    global _phone_bridge_ws

    await websocket.accept()
    _phone_bridge_ws = websocket
    daemon.phone_ws = websocket
    print("🔗 Stitch Flow: Phone bridge connected")

    # Set the event loop on the daemon so it can enqueue events
    loop = asyncio.get_running_loop()
    daemon.set_event_loop(loop)

    # Two concurrent tasks: forward events to phone + receive from phone
    async def forward_events():
        """Read events from daemon queue and send to phone."""
        while True:
            try:
                event = await daemon.get_event()
                if event:
                    await websocket.send_text(json.dumps(event))
            except Exception:
                break

    async def receive_from_phone():
        """Handle messages from the phone."""
        while True:
            try:
                data = await websocket.receive_text()
                msg = json.loads(data)
                msg_type = msg.get("t")

                if msg_type == "verify_otp":
                    otp = msg.get("otp", "")
                    name = msg.get("name", "Phone")
                    w = msg.get("w", 1080)
                    h = msg.get("h", 2400)

                    device_id = daemon.pairing.verify_otp(otp)
                    if device_id:
                        device = daemon.pair_device(name, w, h, device_id)
                        await websocket.send_text(json.dumps({
                            "t": "pair_success",
                            "device_id": device.device_id,
                            "token": device.session_token,
                            "edge": device.edge,
                        }))
                        print(f"🔗 Device paired: {name} ({w}x{h})")
                    else:
                        await websocket.send_text(json.dumps({
                            "t": "pair_failed",
                            "reason": "Invalid or expired OTP",
                        }))

                elif msg_type == "dimensions":
                    w = msg.get("w", 1080)
                    h = msg.get("h", 2400)
                    device_id = msg.get("device_id", "")
                    for d in daemon.config.devices:
                        if d.device_id == device_id:
                            d.phone_width = w
                            d.phone_height = h
                    print(f"🔗 Phone dimensions updated: {w}x{h}")

                elif msg_type == "return":
                    daemon.transition_to_desktop()

                elif msg_type == "heartbeat":
                    await websocket.send_text(json.dumps({"t": "heartbeat_ack"}))

            except WebSocketDisconnect:
                break
            except Exception as e:
                print(f"🔗 Bridge receive error: {e}")
                break

    # Run both tasks concurrently
    forward_task = asyncio.create_task(forward_events())
    receive_task = asyncio.create_task(receive_from_phone())

    try:
        done, pending = await asyncio.wait(
            [forward_task, receive_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
    except Exception:
        pass
    finally:
        _phone_bridge_ws = None
        daemon.phone_ws = None
        # If cursor was on phone, return to desktop
        if daemon.active:
            daemon.transition_to_desktop()
        print("🔗 Stitch Flow: Phone bridge disconnected")


# ---------------------------------------------------------------------------
# WebSocket: Dashboard Status Stream
# ---------------------------------------------------------------------------

@router.websocket("/ws/status")
async def status_stream_ws(websocket: WebSocket):
    """Real-time status updates for the dashboard UI."""
    await websocket.accept()

    try:
        while True:
            status = daemon.get_status()
            status["phone_connected"] = _phone_bridge_ws is not None
            await websocket.send_json(status)
            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
