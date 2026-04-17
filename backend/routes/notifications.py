from fastapi import APIRouter, Request
import subprocess
import os

router = APIRouter()

from typing import List, Dict
from datetime import datetime

NOTIFICATIONS_HISTORY: List[Dict] = []

@router.post("/send_to_desktop")
async def receive_notification(request: Request):
    """Receive a notification from the mobile app and display it on the desktop."""
    data = await request.json()
    title = data.get("title", "Incoming Notification")
    body = data.get("body", "")
    app_name = data.get("app_name", "Phone")

    print(f"\n[🔔 NOTIFICATION RECEIVED] App: {app_name} | Title: {title} | Body: {body}")

    # Save to history for the dashboard
    NOTIFICATIONS_HISTORY.insert(0, {
        "app_name": app_name,
        "title": title,
        "body": body,
        "time": datetime.now().strftime("%I:%M %p")
    })
    if len(NOTIFICATIONS_HISTORY) > 30:
        NOTIFICATIONS_HISTORY.pop()

    # Build environment with proper display/session vars for notify-send
    env = os.environ.copy()
    
    # 1. Provide DISPLAY
    env["DISPLAY"] = os.environ.get("DISPLAY", ":0")

    # 2. XDG_RUNTIME_DIR is strictly required by notify-send under systemd
    uid = os.getuid()
    if uid == 0:
        uid = 1000 # Fallback to standard desktop user UID if service is running as root
        
    if "XDG_RUNTIME_DIR" not in env:
        env["XDG_RUNTIME_DIR"] = f"/run/user/{uid}"

    # 3. DBUS_SESSION_BUS_ADDRESS is strictly required for sending DBUS messages to the desktop
    if "DBUS_SESSION_BUS_ADDRESS" not in env:
        env["DBUS_SESSION_BUS_ADDRESS"] = f"unix:path=/run/user/{uid}/bus"

    if "PATH" not in env:
        env["PATH"] = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

    # Use notify-send on Linux Desktop to display the notification
    # -u normal = normal urgency, -i phone = phone icon if available
    command = [
        "/usr/bin/notify-send",
        "-a", app_name,
        "-u", "normal",
        "-i", "phone",
        f"📱 {title}",
        body
    ]
    try:
        subprocess.Popen(command, env=env)
        print("-> Successfully triggered notify-send command.")
        return {"status": "success", "message": "Notification forwarded to desktop"}
    except Exception as e:
        print(f"-> [!] Failed to trigger notify-send: {str(e)}")
        return {"status": "error", "error": str(e)}


def _find_user_pid():
    """Find a PID of a user's desktop session process to grab env vars from."""
    try:
        # Try gnome-session first
        result = subprocess.run(["pgrep", "-u", str(os.getuid()), "gnome-session"],
                                capture_output=True, text=True, timeout=3)
        if result.stdout.strip():
            return result.stdout.strip().split('\n')[0]
        # Fallback to any user shell
        result = subprocess.run(["pgrep", "-u", str(os.getuid()), "-o"],
                                capture_output=True, text=True, timeout=3)
        return result.stdout.strip().split('\n')[0]
    except Exception:
        return "1"

@router.get("/history")
def get_notification_history():
    return {"notifications": NOTIFICATIONS_HISTORY}
