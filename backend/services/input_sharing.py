"""
Stitch Flow — Cross-Device Input Sharing Daemon

Edge detection, input grabbing, and WebSocket relay to Android devices.
Runs as a background thread within the FastAPI backend.
"""

import asyncio
import json
import os
import secrets
import threading
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Callable

from pynput.mouse import Controller as MouseController, Listener as MouseListener
from pynput.keyboard import Controller as KbdController, Listener as KbdListener, Key, KeyCode

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "input_sharing_config.json")


class Edge(str, Enum):
    RIGHT = "right"
    LEFT = "left"
    TOP = "top"
    BOTTOM = "bottom"


@dataclass
class DeviceConfig:
    name: str = "Phone"
    device_id: str = ""
    edge: str = "right"
    phone_width: int = 1080
    phone_height: int = 2400
    paired: bool = False
    session_token: str = ""


@dataclass
class SharingConfig:
    devices: List[DeviceConfig] = field(default_factory=list)
    enabled: bool = True
    default_edge: str = "right"
    cursor_speed_multiplier: float = 2.5
    edge_threshold_px: int = 2
    edge_dwell_ms: int = 150


def load_config() -> SharingConfig:
    try:
        with open(CONFIG_PATH, "r") as f:
            data = json.load(f)
        cfg = SharingConfig(
            devices=[DeviceConfig(**d) for d in data.get("devices", [])],
            enabled=data.get("enabled", True),
            default_edge=data.get("default_edge", "right"),
            cursor_speed_multiplier=data.get("cursor_speed_multiplier", 2.5),
            edge_threshold_px=data.get("edge_threshold_px", 2),
            edge_dwell_ms=data.get("edge_dwell_ms", 150),
        )
        return cfg
    except Exception:
        return SharingConfig()


def save_config(cfg: SharingConfig):
    data = {
        "devices": [
            {
                "name": d.name,
                "device_id": d.device_id,
                "edge": d.edge,
                "phone_width": d.phone_width,
                "phone_height": d.phone_height,
                "paired": d.paired,
                "session_token": d.session_token,
            }
            for d in cfg.devices
        ],
        "enabled": cfg.enabled,
        "default_edge": cfg.default_edge,
        "cursor_speed_multiplier": cfg.cursor_speed_multiplier,
        "edge_threshold_px": cfg.edge_threshold_px,
        "edge_dwell_ms": cfg.edge_dwell_ms,
    }
    with open(CONFIG_PATH, "w") as f:
        json.dump(data, f, indent=2)


# ---------------------------------------------------------------------------
# Screen info helper
# ---------------------------------------------------------------------------

def get_screen_size() -> tuple:
    """Get primary screen dimensions. Falls back to xdpyinfo or safe default."""
    try:
        import subprocess
        result = subprocess.run(
            ["xdpyinfo"], capture_output=True, text=True, timeout=3
        )
        for line in result.stdout.splitlines():
            if "dimensions:" in line:
                # e.g. "  dimensions:    1920x1080 pixels (..."
                parts = line.strip().split()
                dim = parts[1]  # "1920x1080"
                w, h = dim.split("x")
                return int(w), int(h)
    except Exception:
        pass
    # Fallback: try xrandr
    try:
        import subprocess
        result = subprocess.run(
            ["xrandr", "--current"], capture_output=True, text=True, timeout=3
        )
        for line in result.stdout.splitlines():
            if " connected primary " in line or (" connected " in line and "+" in line):
                # e.g. "eDP-1 connected primary 1920x1080+0+0 ..."
                for token in line.split():
                    if "x" in token and "+" in token:
                        dim = token.split("+")[0]
                        w, h = dim.split("x")
                        return int(w), int(h)
    except Exception:
        pass
    return 1920, 1080


# ---------------------------------------------------------------------------
# Pairing Manager
# ---------------------------------------------------------------------------

class PairingManager:
    """Handles OTP-based device pairing."""

    def __init__(self):
        self.active_otp: Optional[str] = None
        self.otp_created_at: float = 0
        self.otp_device_id: str = ""
        self.OTP_EXPIRY_SECONDS = 120

    def generate_otp(self) -> str:
        self.active_otp = f"{secrets.randbelow(1000000):06d}"
        self.otp_created_at = time.time()
        self.otp_device_id = secrets.token_hex(8)
        return self.active_otp

    def verify_otp(self, code: str) -> Optional[str]:
        """Returns device_id if valid, None otherwise."""
        if not self.active_otp:
            return None
        if time.time() - self.otp_created_at > self.OTP_EXPIRY_SECONDS:
            self.active_otp = None
            return None
        if code == self.active_otp:
            device_id = self.otp_device_id
            self.active_otp = None
            return device_id
        return None


# ---------------------------------------------------------------------------
# Key mapping: pynput Key objects → string names for the wire protocol
# ---------------------------------------------------------------------------

PYNPUT_KEY_TO_NAME = {}
for attr in dir(Key):
    if not attr.startswith("_"):
        PYNPUT_KEY_TO_NAME[getattr(Key, attr)] = attr


def key_to_str(key) -> str:
    if isinstance(key, Key):
        return PYNPUT_KEY_TO_NAME.get(key, str(key))
    if isinstance(key, KeyCode):
        if key.char:
            return key.char
        if key.vk:
            return f"vk_{key.vk}"
    return str(key)


# ---------------------------------------------------------------------------
# Input Sharing Daemon
# ---------------------------------------------------------------------------

class InputSharingDaemon:
    """
    Monitors mouse position for edge transitions, captures input when
    transitioned to phone, and relays events through an async queue.
    """

    def __init__(self):
        self.config = load_config()
        self.pairing = PairingManager()

        # Screen
        self.screen_w, self.screen_h = get_screen_size()

        # State
        self.active = False  # True = cursor is on phone
        self.active_device: Optional[DeviceConfig] = None
        self.enabled = self.config.enabled
        self.running = False

        # Virtual cursor position on phone
        self.phone_cursor_x = 0.0
        self.phone_cursor_y = 0.0

        # Edge dwell tracking
        self._edge_dwell_start: float = 0
        self._edge_dwelling: bool = False
        self._last_edge: Optional[str] = None

        # Mouse controller for repositioning
        self._mouse = MouseController()

        # Listeners
        self._mouse_listener: Optional[MouseListener] = None
        self._kbd_listener: Optional[KbdListener] = None

        # Event queue (consumed by the WebSocket bridge)
        self._event_queue: asyncio.Queue = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None

        # Status callbacks for the dashboard
        self._status_callbacks: List[Callable] = []

        # Phone WebSocket connection reference (set by the route module)
        self.phone_ws = None

        # Thread
        self._thread: Optional[threading.Thread] = None

        # Lock for state transitions
        self._lock = threading.Lock()

    def set_event_loop(self, loop: asyncio.AbstractEventLoop):
        self._loop = loop
        self._event_queue = asyncio.Queue()

    def _enqueue_event(self, event: dict):
        """Thread-safe enqueue into the async event queue."""
        if self._loop and self._event_queue:
            self._loop.call_soon_threadsafe(self._event_queue.put_nowait, event)

    async def get_event(self) -> dict:
        """Async get next event (used by WebSocket bridge)."""
        if self._event_queue:
            return await self._event_queue.get()
        await asyncio.sleep(1)
        return {}

    def start(self):
        if self.running:
            return
        self.running = True
        self.config = load_config()
        self.enabled = self.config.enabled
        self.screen_w, self.screen_h = get_screen_size()
        self._thread = threading.Thread(target=self._run_monitor, daemon=True)
        self._thread.start()
        print(f"🔗 Stitch Flow daemon started (screen: {self.screen_w}x{self.screen_h})")

    def stop(self):
        self.running = False
        self._cleanup_listeners()
        if self._thread:
            self._thread.join(timeout=2)
        print("🔗 Stitch Flow daemon stopped")

    def reload_config(self):
        self.config = load_config()
        self.enabled = self.config.enabled
        self.screen_w, self.screen_h = get_screen_size()

    # ── Edge detection loop ───────────────────────────────────────────

    def _run_monitor(self):
        """Monitor loop running at ~120Hz checking cursor position."""
        while self.running:
            if not self.enabled or self.active:
                time.sleep(0.05)
                continue

            try:
                mx, my = self._mouse.position
                edge = self._check_edge(mx, my)
                if edge:
                    device = self._get_device_for_edge(edge)
                    if device and device.paired:
                        if not self._edge_dwelling or self._last_edge != edge:
                            self._edge_dwelling = True
                            self._edge_dwell_start = time.time()
                            self._last_edge = edge
                        elif (time.time() - self._edge_dwell_start) * 1000 >= self.config.edge_dwell_ms:
                            self._transition_to_phone(device, edge)
                            self._edge_dwelling = False
                else:
                    self._edge_dwelling = False
                    self._last_edge = None
            except Exception as e:
                print(f"Stitch Flow monitor error: {e}")

            time.sleep(1 / 120)  # ~120Hz polling

    def _check_edge(self, mx: int, my: int) -> Optional[str]:
        threshold = self.config.edge_threshold_px
        if mx >= self.screen_w - threshold:
            return "right"
        if mx <= threshold:
            return "left"
        if my <= threshold:
            return "top"
        if my >= self.screen_h - threshold:
            return "bottom"
        return None

    def _get_device_for_edge(self, edge: str) -> Optional[DeviceConfig]:
        for d in self.config.devices:
            if d.edge == edge and d.paired:
                return d
        return None

    # ── Transition logic ──────────────────────────────────────────────

    def _transition_to_phone(self, device: DeviceConfig, edge: str):
        with self._lock:
            if self.active:
                return
            self.active = True
            self.active_device = device

        # Set initial cursor position on phone based on edge
        if edge == "right":
            self.phone_cursor_x = 0.0
            self.phone_cursor_y = device.phone_height / 2.0
        elif edge == "left":
            self.phone_cursor_x = float(device.phone_width)
            self.phone_cursor_y = device.phone_height / 2.0
        elif edge == "top":
            self.phone_cursor_x = device.phone_width / 2.0
            self.phone_cursor_y = float(device.phone_height)
        elif edge == "bottom":
            self.phone_cursor_x = device.phone_width / 2.0
            self.phone_cursor_y = 0.0

        # Move desktop cursor to center (so we have room for delta capture)
        center_x = self.screen_w // 2
        center_y = self.screen_h // 2
        self._mouse.position = (center_x, center_y)
        self._last_mouse_x = center_x
        self._last_mouse_y = center_y

        # Start input capture
        self._start_input_capture()

        # Notify
        self._enqueue_event({
            "t": "transition",
            "to": "phone",
            "device": device.name,
            "edge": edge,
            "cx": int(self.phone_cursor_x),
            "cy": int(self.phone_cursor_y),
        })
        self._broadcast_status()
        print(f"🔗 Cursor → {device.name} (via {edge} edge)")

    def transition_to_desktop(self):
        with self._lock:
            if not self.active:
                return
            device = self.active_device
            self.active = False
            self.active_device = None

        self._cleanup_listeners()

        # Return cursor to appropriate edge position
        if device:
            edge = device.edge
            if edge == "right":
                self._mouse.position = (self.screen_w - 20, self.screen_h // 2)
            elif edge == "left":
                self._mouse.position = (20, self.screen_h // 2)
            elif edge == "top":
                self._mouse.position = (self.screen_w // 2, 20)
            elif edge == "bottom":
                self._mouse.position = (self.screen_w // 2, self.screen_h - 20)

        self._enqueue_event({"t": "transition", "to": "desktop"})
        self._broadcast_status()
        print("🔗 Cursor → Desktop")

    # ── Input capture ────────────────────────────────────────────────

    def _start_input_capture(self):
        self._cleanup_listeners()

        # Track the last known position for computing deltas
        center_x = self.screen_w // 2
        center_y = self.screen_h // 2
        self._last_mouse_x = center_x
        self._last_mouse_y = center_y
        self._suppress_reposition = False
        self._last_send_time = 0

        def on_move(x, y):
            try:
                if not self.active or self._suppress_reposition:
                    return

                dx = x - self._last_mouse_x
                dy = y - self._last_mouse_y

                # DEBUG: Print deltas
                if abs(dx) > 0 or abs(dy) > 0:
                    print(f"Stitch Flow Delta: dx={dx:.1f}, dy={dy:.1f} | Phone Cursor: {self.phone_cursor_x:.1f}, {self.phone_cursor_y:.1f}")

                # Ignore tiny jitters
                if abs(dx) < 0.1 and abs(dy) < 0.1:
                    return

                # Throttle move events to ~90Hz to prevent bridge congestion
                now = time.time()
                if now - self._last_send_time < 0.011: # ~90Hz
                    return
                self._last_send_time = now

                # Apply speed multiplier
                mult = self.config.cursor_speed_multiplier
                fdx = dx * mult
                fdy = dy * mult

                # Update phone cursor
                if self.active_device:
                    self.phone_cursor_x = max(0.0, min(float(self.active_device.phone_width),
                                                      self.phone_cursor_x + fdx))
                    self.phone_cursor_y = max(0.0, min(float(self.active_device.phone_height),
                                                      self.phone_cursor_y + fdy))

                    # Check if cursor hit return edge on phone
                    if self._check_phone_return_edge():
                        self.transition_to_desktop()
                        return

                # Emit move event
                self._enqueue_event({
                    "t": "m",
                    "x": int(self.phone_cursor_x),
                    "y": int(self.phone_cursor_y),
                })

                # Reposition desktop cursor to center to maintain capture range
                self._suppress_reposition = True
                self._mouse.position = (center_x, center_y)
                # We don't update last_mouse_x/y here; we wait for the next OS event 
                # triggered by this repositioning or the next user move.
                # Actually, to be safe on X11:
                self._last_mouse_x = center_x
                self._last_mouse_y = center_y
                self._suppress_reposition = False
            except Exception as e:
                print(f"Stitch Flow: Mouse move error: {e}")

        def on_click(x, y, button, pressed):
            try:
                if not self.active:
                    return
                from pynput.mouse import Button
                btn = "l" if button == Button.left else ("r" if button == Button.right else "m")
                self._enqueue_event({
                    "t": "cd" if pressed else "cu",
                    "b": btn,
                    "x": int(self.phone_cursor_x),
                    "y": int(self.phone_cursor_y),
                })
            except Exception as e:
                print(f"Stitch Flow: Click error: {e}")

        def on_scroll(x, y, dx, dy):
            try:
                if not self.active:
                    return
                self._enqueue_event({
                    "t": "s",
                    "dx": dx,
                    "dy": dy,
                    "x": int(self.phone_cursor_x),
                    "y": int(self.phone_cursor_y),
                })
            except Exception as e:
                print(f"Stitch Flow: Scroll error: {e}")

        self._mouse_listener = MouseListener(
            on_move=on_move,
            on_click=on_click,
            on_scroll=on_scroll,
            suppress=True,  # Grab the mouse - cursor becomes invisible/locked
        )
        self._mouse_listener.start()
        print("Stitch Flow: Mouse listener started")

        def on_key_press(key):
            try:
                if not self.active:
                    return
                # Escape key = emergency return to desktop
                if key == Key.esc:
                    self.transition_to_desktop()
                    return False  # Stop listener
                self._enqueue_event({
                    "t": "kd",
                    "k": key_to_str(key),
                })
            except Exception as e:
                print(f"Stitch Flow: Key press error: {e}")

        def on_key_release(key):
            try:
                if not self.active:
                    return
                self._enqueue_event({
                    "t": "ku",
                    "k": key_to_str(key),
                })
            except Exception as e:
                print(f"Stitch Flow: Key release error: {e}")

        self._kbd_listener = KbdListener(
            on_press=on_key_press,
            on_release=on_key_release,
            suppress=True,  # Grab the keyboard
        )
        self._kbd_listener.start()
        print("Stitch Flow: Keyboard listener started")

    def _check_phone_return_edge(self) -> bool:
        """Check if phone cursor reached the return edge (opposite of entry)."""
        if not self.active_device:
            return False
        edge = self.active_device.edge
        threshold = 5  # pixels
        if edge == "right" and self.phone_cursor_x <= threshold:
            return True
        if edge == "left" and self.phone_cursor_x >= self.active_device.phone_width - threshold:
            return True
        if edge == "top" and self.phone_cursor_y >= self.active_device.phone_height - threshold:
            return True
        if edge == "bottom" and self.phone_cursor_y <= threshold:
            return True
        return False

    def _cleanup_listeners(self):
        if self._mouse_listener:
            try:
                self._mouse_listener.stop()
            except Exception:
                pass
            self._mouse_listener = None
        if self._kbd_listener:
            try:
                self._kbd_listener.stop()
            except Exception:
                pass
            self._kbd_listener = None

    # ── Status broadcasting ──────────────────────────────────────────

    def get_status(self) -> dict:
        return {
            "enabled": self.enabled,
            "active": self.active,
            "active_device": self.active_device.name if self.active_device else None,
            "screen_size": [self.screen_w, self.screen_h],
            "phone_cursor": [int(self.phone_cursor_x), int(self.phone_cursor_y)] if self.active else None,
            "devices": [
                {
                    "name": d.name,
                    "device_id": d.device_id,
                    "edge": d.edge,
                    "paired": d.paired,
                    "phone_size": [d.phone_width, d.phone_height],
                }
                for d in self.config.devices
            ],
            "config": {
                "cursor_speed_multiplier": self.config.cursor_speed_multiplier,
                "edge_threshold_px": self.config.edge_threshold_px,
                "edge_dwell_ms": self.config.edge_dwell_ms,
            }
        }

    def _broadcast_status(self):
        for cb in self._status_callbacks:
            try:
                cb(self.get_status())
            except Exception:
                pass

    def add_status_callback(self, cb: Callable):
        self._status_callbacks.append(cb)

    def remove_status_callback(self, cb: Callable):
        try:
            self._status_callbacks.remove(cb)
        except ValueError:
            pass

    # ── Device management ─────────────────────────────────────────────

    def pair_device(self, name: str, phone_width: int, phone_height: int,
                    device_id: str) -> DeviceConfig:
        """Complete pairing for a device."""
        token = secrets.token_hex(16)

        # Check if device already exists
        for d in self.config.devices:
            if d.device_id == device_id:
                d.name = name
                d.phone_width = phone_width
                d.phone_height = phone_height
                d.paired = True
                d.session_token = token
                save_config(self.config)
                return d

        device = DeviceConfig(
            name=name,
            device_id=device_id,
            edge=self.config.default_edge,
            phone_width=phone_width,
            phone_height=phone_height,
            paired=True,
            session_token=token,
        )
        self.config.devices.append(device)
        save_config(self.config)
        return device

    def unpair_device(self, device_id: str):
        self.config.devices = [d for d in self.config.devices if d.device_id != device_id]
        save_config(self.config)

    def update_device_edge(self, device_id: str, edge: str):
        for d in self.config.devices:
            if d.device_id == device_id:
                d.edge = edge
                save_config(self.config)
                return True
        return False

    def update_settings(self, speed: float = None, threshold: int = None,
                        dwell: int = None, enabled: bool = None):
        if speed is not None:
            self.config.cursor_speed_multiplier = speed
        if threshold is not None:
            self.config.edge_threshold_px = threshold
        if dwell is not None:
            self.config.edge_dwell_ms = dwell
        if enabled is not None:
            self.config.enabled = enabled
            self.enabled = enabled
        save_config(self.config)


# ---------------------------------------------------------------------------
# Singleton instance
# ---------------------------------------------------------------------------

daemon = InputSharingDaemon()
