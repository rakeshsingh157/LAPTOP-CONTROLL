import psutil
import platform
import os
import shutil
import subprocess
import time
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
import asyncio
import time
from fastapi.responses import FileResponse
from pydantic import BaseModel
import pyperclip
import tempfile
import base64


router = APIRouter()
CURRENT_DIR = os.path.expanduser("~") # Initialize to user's home directory

class RenameRequest(BaseModel):
    old_path: str
    new_path: str

class WriteRequest(BaseModel):
    path: str
    content: str

@router.get("/metrics")
def get_system_metrics():
    # Simple CPU, RAM, Disk metrics
    cpu_percent = psutil.cpu_percent(interval=1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    uptime_seconds = int(time.time() - psutil.boot_time())
    
    return {
        "cpu_usage": cpu_percent,
        "ram_usage": {"total": memory.total, "used": memory.used, "percent": memory.percent},
        "disk_usage": {"total": disk.total, "used": disk.used, "percent": disk.percent},
        "os": platform.system(),
        "release": platform.release(),
        "uptime": uptime_seconds,
    }

@router.post("/terminal")
def execute_command(command: str):
    global CURRENT_DIR
    try:
        # Wrap the command so bash tells us where it ended up after executing.
        # This makes commands like `cd -`, `pushd`, etc. work perfectly natively.
        wrapped_cmd = f"source ~/.bashrc 2>/dev/null; {command}\nRET=$?\npwd\nexit $RET"
        
        result = subprocess.run(wrapped_cmd, shell=True, executable='/bin/bash', capture_output=True, text=True, cwd=CURRENT_DIR)
        
        lines = result.stdout.splitlines()
        stdout = ""
        
        if lines:
            possible_pwd = lines[-1].strip()
            if os.path.isdir(possible_pwd):
                # The command successfully printed a directory at the end
                CURRENT_DIR = possible_pwd
                stdout = "\n".join(lines[:-1])
                if len(lines) > 1: stdout += "\n"
            else:
                stdout = result.stdout
                
        return {"stdout": stdout, "stderr": result.stderr, "cwd": CURRENT_DIR}
    except Exception as e:
        return {"error": str(e), "cwd": CURRENT_DIR}

@router.get("/files")
def list_files(path: str = None):
    # Retrieve files for a given directory, defaults to user home
    target_path = os.path.abspath(path) if path else os.path.expanduser("~")
    
    if not os.path.isdir(target_path):
        raise HTTPException(status_code=404, detail="Directory not found")
        
    try:
        items = []
        for filename in os.listdir(target_path):
            full_path = os.path.join(target_path, filename)
            is_dir = os.path.isdir(full_path)
            size = os.path.getsize(full_path) if not is_dir else 0
            items.append({
                "name": filename,
                "is_dir": is_dir,
                "size": size,
                "path": full_path
            })
        
        # Sort folders first, then files alphabetically
        items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
        
        return {
            "current_dir": target_path,
            "items": items
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/file/read")
def read_file(path: str):
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="File not found")
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/file/write")
def write_file(req: WriteRequest):
    try:
        with open(req.path, 'w', encoding='utf-8') as f:
            f.write(req.content)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/file/rename")
def rename_file(req: RenameRequest):
    try:
        os.rename(req.old_path, req.new_path)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/file/delete")
def delete_file(path: str):
    try:
        if os.path.isdir(path):
            shutil.rmtree(path)
        else:
            os.remove(path)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/file/download")
def download_file(path: str):
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="File not found")
    
    # Do not set filename to allow inline viewing (e.g. video/mp4) in WebViews
    ext = path.lower().split('.')[-1]
    if ext in ['mp4', 'webm', 'mov', 'pdf', 'mp3', 'wav', 'ogg']:
        import mimetypes
        media_type, _ = mimetypes.guess_type(path)
        return FileResponse(path=path, media_type=media_type)
        
    return FileResponse(path=path, filename=os.path.basename(path))

class PushRequest(BaseModel):
    token: str

@router.post("/push/register")
def register_push(req: PushRequest):
    with open("push_token.txt", "w") as f:
        f.write(req.token)
    return {"success": True}

@router.websocket("/ws/metrics")
async def websocket_metrics(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # We don't want to block the event loop heavily, but psutil.cpu_percent(interval=1) blocks.
            # To be async-friendly, we can sleep asynchronously and use interval=0 or None
            cpu_percent = psutil.cpu_percent(interval=None)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            uptime_seconds = int(time.time() - psutil.boot_time())
            
            data = {
                "cpu_usage": cpu_percent,
                "ram_usage": {"total": memory.total, "used": memory.used, "percent": memory.percent},
                "disk_usage": {"total": disk.total, "used": disk.used, "percent": disk.percent},
                "os": platform.system(),
                "release": platform.release(),
                "uptime": uptime_seconds,
            }
            await websocket.send_json(data)
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        print("Metrics WS Disconnected")


class ClipboardData(BaseModel):
    type: str # 'text' or 'image'
    content: str # plain text or base64 data

@router.get("/clipboard")
def get_clipboard():
    try:
        # Check if it's an image
        res_targets = subprocess.run(['/usr/bin/xclip', '-selection', 'clipboard', '-t', 'TARGETS', '-o'], capture_output=True, text=True)
        if "image/png" in res_targets.stdout or "image/" in res_targets.stdout:
            res_img = subprocess.run(['/usr/bin/xclip', '-selection', 'clipboard', '-t', 'image/png', '-o'], capture_output=True)
            if res_img.returncode == 0 and len(res_img.stdout) > 0:
                b64 = base64.b64encode(res_img.stdout).decode('utf-8')
                return {"type": "image", "content": b64}
                
        # Otherwise return text
        return {"type": "text", "content": pyperclip.paste() or ""}
    except Exception as e:
        return {"type": "text", "content": "", "error": str(e)}

@router.post("/clipboard")
def set_clipboard(data: ClipboardData):
    try:
        if data.type == 'image':
            img_bytes = base64.b64decode(data.content)
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
                f.write(img_bytes)
                f.flush()
                subprocess.run(['/usr/bin/xclip', '-selection', 'clipboard', '-t', 'image/png', '-i', f.name])
            return {"success": True}
        else:
            pyperclip.copy(data.content)
            return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/clipboard/hash")
def get_clipboard_hash():
    """Returns just the hash of the current clipboard content for efficient polling."""
    try:
        content = pyperclip.paste() or ""
        return {"hash": hash(content) & 0xFFFFFFFF}  # positive 32-bit hash
    except Exception:
        return {"hash": 0}

@router.post("/file/upload")
async def upload_file(path: str, file: UploadFile = File(...)):
    try:
        target_path = os.path.join(path, file.filename)
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"success": True, "path": target_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


import json

@router.websocket("/ws/screen")
async def screen_stream(websocket: WebSocket):
    await websocket.accept()
    
    try:
        import mss
        from PIL import Image
        import io
        import base64
        from pynput.mouse import Controller, Button
        from pynput.keyboard import Controller as KbdController, Key
        import asyncio

        mouse = Controller()
        kbd = KbdController()
        sct = mss.mss()
        # Grab primary monitor (monitor 1)
        monitor = sct.monitors[1] if len(sct.monitors) > 1 else sct.monitors[0]
        screen_w = monitor["width"]
        screen_h = monitor["height"]
        
        async def receive_events():
            try:
                while True:
                    data = await websocket.receive_text()
                    event = json.loads(data)
                    action = event.get("action")
                    px = max(0.0, min(1.0, float(event.get("x", 0.5))))
                    py = max(0.0, min(1.0, float(event.get("y", 0.5))))
                    
                    mx = monitor["left"] + int(px * screen_w)
                    my = monitor["top"] + int(py * screen_h)
                    
                    if "x" in event and "y" in event:
                        mouse.position = (mx, my)
                    
                    if action == "click":
                        mouse.click(Button.left)
                    elif action == "right_click":
                        mouse.click(Button.right)
                    elif action == "mouse_down":
                        mouse.press(Button.left)
                    elif action == "mouse_up":
                        mouse.release(Button.left)
                    elif action == "scroll":
                        mouse.scroll(float(event.get("dx", 0)), float(event.get("dy", 0)))
                    elif action == "key":
                        k = event.get("key")
                        if k:
                            mods = event.get("modifiers", {})
                            
                            # Specific override for terminal shortcut (Ctrl+Alt+T) bypassing pynput limitations on Wayland
                            if str(k).lower() == "t" and mods.get("ctrl") and mods.get("alt"):
                                import subprocess
                                try:
                                    # Try default handler
                                    subprocess.Popen(["xdg-terminal"])
                                except Exception:
                                    try:
                                        subprocess.Popen(["gnome-terminal"])
                                    except:
                                        pass
                                continue

                            pressed_mods = []
                            if mods.get("ctrl"): pressed_mods.append(Key.ctrl)
                            if mods.get("alt"): pressed_mods.append(Key.alt)
                            if mods.get("shift"): pressed_mods.append(Key.shift)
                            if mods.get("win"): pressed_mods.append(Key.cmd)
                            
                            for m in pressed_mods:
                                kbd.press(m)
                                
                            try:
                                k_lower = str(k).lower()
                                if k_lower == "backspace":
                                    k_obj = Key.backspace
                                elif k_lower == "enter":
                                    k_obj = Key.enter
                                elif k_lower == "escape":
                                    k_obj = Key.esc
                                elif k_lower == "tab":
                                    k_obj = Key.tab
                                elif k_lower == "space":
                                    k_obj = Key.space
                                elif k_lower == "arrowup":
                                    k_obj = Key.up
                                elif k_lower == "arrowdown":
                                    k_obj = Key.down
                                elif k_lower == "arrowleft":
                                    k_obj = Key.left
                                elif k_lower == "arrowright":
                                    k_obj = Key.right
                                elif hasattr(Key, k_lower): # Matches f1..f12, page_up, page_down etc
                                    k_obj = getattr(Key, k_lower)
                                else:
                                    k_obj = k
                                    
                                kbd.press(k_obj)
                                kbd.release(k_obj)
                            except Exception as ek:
                                print("Key err:", ek)
                                
                            for m in reversed(pressed_mods):
                                kbd.release(m)
                    elif action == "modifier":
                        mod = event.get("mod")
                        state = event.get("state")
                        k_obj = None
                        if mod == "ctrl": k_obj = Key.ctrl
                        elif mod == "alt": k_obj = Key.alt
                        elif mod == "win": k_obj = Key.cmd
                        elif mod == "shift": k_obj = Key.shift
                        
                        if k_obj:
                            try:
                                if state == "down":
                                    kbd.press(k_obj)
                                else:
                                    kbd.release(k_obj)
                            except Exception as ek:
                                print("Mod err:", ek)
            except Exception as e:
                print("Recv loop err:", e)

        task = asyncio.create_task(receive_events())
        
        try:
            while True:
                try:
                    sct_img = sct.grab(monitor)
                    img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")
                    img.thumbnail((1600, 1600))
                    buffer = io.BytesIO()
                    img.save(buffer, format="JPEG", quality=85)
                    b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
                    await websocket.send_text(json.dumps({"type": "frame", "data": b64}))
                except Exception as ex:
                    if "XGetImage() failed" in str(ex):
                        await websocket.send_text(json.dumps({
                            "type": "error", 
                            "message": "Wayland Display Blocked.\n\nPlease log out of your computer and select 'Ubuntu on Xorg' using the bottom-right gear icon on the login screen to allow Live Remote Desktop."
                        }))
                    else:
                        print("Screen error:", ex)
                        break
                    await asyncio.sleep(2)
                    continue
                await asyncio.sleep(0.1)
        except Exception as e:
            pass
        finally:
            task.cancel()
    except Exception as e:
        import traceback
        traceback.print_exc()
        await websocket.close()

# ---- FIND MY DEVICE ROUTES ----

PHONE_WS_CONNECTION = None
PHONE_TELEMETRY = {
    "batteryLevel": 100,
    "isCharging": False,
    "isWifiEnabled": False,
    "isBluetoothEnabled": False
}

@router.websocket("/phone_ws")
async def phone_command_ws(websocket: WebSocket):
    global PHONE_WS_CONNECTION, PHONE_TELEMETRY
    await websocket.accept()
    PHONE_WS_CONNECTION = websocket
    print("📱 Phone Command WS Connected to Desktop")
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("status") == "telemetry":
                    PHONE_TELEMETRY["batteryLevel"] = msg.get("batteryLevel", 0)
                    PHONE_TELEMETRY["isCharging"] = msg.get("isCharging", False)
                    PHONE_TELEMETRY["isWifiEnabled"] = msg.get("isWifiEnabled", False)
                    PHONE_TELEMETRY["isBluetoothEnabled"] = msg.get("isBluetoothEnabled", False)
                    PHONE_TELEMETRY["ringerMode"] = msg.get("ringerMode", 2)
                    PHONE_TELEMETRY["airplaneMode"] = msg.get("airplaneMode", False)
                    PHONE_TELEMETRY["isLocationEnabled"] = msg.get("isLocationEnabled", False)
                    PHONE_TELEMETRY["isTheftShieldEnabled"] = msg.get("isTheftShieldEnabled", False)
                    PHONE_TELEMETRY["dndFilter"] = msg.get("dndFilter", 1)
                    PHONE_TELEMETRY["carrierName"] = msg.get("carrierName", "No SIM")
                    PHONE_TELEMETRY["songTitle"] = msg.get("songTitle", "No music playing")
                    PHONE_TELEMETRY["artistName"] = msg.get("artistName", "")
                    PHONE_TELEMETRY["isPlaying"] = msg.get("isPlaying", False)
                    
                    # Store latest GPS coordinates if available in telemetry pulse
                    if "lat" in msg and "lon" in msg:
                        PHONE_TELEMETRY["lastLat"] = msg.get("lat")
                        PHONE_TELEMETRY["lastLon"] = msg.get("lon")
                        PHONE_TELEMETRY["lastAccuracy"] = msg.get("accuracy", 0)
                elif msg.get("status") == "location_response":
                    PHONE_TELEMETRY["lastLat"] = msg.get("lat")
                    PHONE_TELEMETRY["lastLon"] = msg.get("lon")
                    PHONE_TELEMETRY["lastAccuracy"] = msg.get("accuracy", 0)
                    with open("/tmp/phone_cmd_response.json", "w") as f:
                        f.write(data)
                else:
                    pass
            except Exception:
                pass
    except WebSocketDisconnect:
        PHONE_WS_CONNECTION = None
        print("📱 Phone Command WS Disconnected")

@router.get("/phone_telemetry")
def get_phone_telemetry():
    return {
        "connected": PHONE_WS_CONNECTION is not None,
        "telemetry": PHONE_TELEMETRY
    }

class PhoneCmd(BaseModel):
    action: str

@router.post("/send_phone_cmd")
async def send_phone_cmd(cmd: PhoneCmd):
    global PHONE_WS_CONNECTION
    if PHONE_WS_CONNECTION is None:
        raise HTTPException(status_code=503, detail="Phone is not connected to Desktop API")
    await PHONE_WS_CONNECTION.send_text(json.dumps({"action": cmd.action}))
    return {"success": True, "message": f"Sent '{cmd.action}' to phone"}

laptop_ring_process = None

@router.post("/laptop/ring")
def laptop_ring():
    global laptop_ring_process
    if laptop_ring_process is None or laptop_ring_process.poll() is not None:
        # Build env with audio session access (systemd strips these)
        env = os.environ.copy()
        uid = os.getuid()
        if uid == 0:
            uid = 1000
        env["XDG_RUNTIME_DIR"] = f"/run/user/{uid}"
        env["PULSE_SERVER"] = f"unix:/run/user/{uid}/pulse/native"
        if "DBUS_SESSION_BUS_ADDRESS" not in env:
            env["DBUS_SESSION_BUS_ADDRESS"] = f"unix:path=/run/user/{uid}/bus"

        # Force unmute and max volume (bypass mute state)
        subprocess.run(["/usr/bin/amixer", "set", "Master", "unmute"], env=env, capture_output=True)
        subprocess.run(["/usr/bin/amixer", "set", "Master", "100%"], env=env, capture_output=True)

        # Play a loud piercing sine wave via speaker-test
        cmd = ["/usr/bin/speaker-test", "-t", "sine", "-f", "1000", "-l", "0"]
        laptop_ring_process = subprocess.Popen(cmd, env=env)
    return {"success": True}

@router.post("/laptop/stop_ring")
def laptop_stop_ring():
    global laptop_ring_process
    if laptop_ring_process and laptop_ring_process.poll() is None:
        laptop_ring_process.kill()  # SIGKILL = instant death
        laptop_ring_process = None
    # Safety net: kill any orphan speaker-test processes
    subprocess.run(["/usr/bin/pkill", "-9", "speaker-test"], capture_output=True)
    return {"success": True}

