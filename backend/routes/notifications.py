from fastapi import APIRouter, Request
import subprocess
import os

router = APIRouter()

@router.post("/send_to_desktop")
async def receive_notification(request: Request):
    """Receive a notification from the mobile app and display it on the desktop."""
    data = await request.json()
    title = data.get("title", "Incoming Notification")
    body = data.get("body", "")
    app_name = data.get("app_name", "Phone")

    # Build environment with proper display/session vars for notify-send
    env = os.environ.copy()
    env["DISPLAY"] = os.environ.get("DISPLAY", ":0")
    env.setdefault("XAUTHORITY", os.path.expanduser("~/.Xauthority"))

    # Detect DBUS_SESSION_BUS_ADDRESS if not set (needed for notify-send via systemd service)
    if "DBUS_SESSION_BUS_ADDRESS" not in env:
        uid = os.getuid()
        dbus_addr = f"unix:path=/run/user/{uid}/bus"
        if os.path.exists(f"/run/user/{uid}/bus"):
            env["DBUS_SESSION_BUS_ADDRESS"] = dbus_addr
        else:
            # Fallback: try to read from /proc for the current user's gnome-session
            try:
                result = subprocess.run(
                    ["grep", "-z", "DBUS_SESSION_BUS_ADDRESS",
                     f"/proc/{_find_user_pid()}/environ"],
                    capture_output=True, timeout=3
                )
                if result.returncode == 0:
                    for part in result.stdout.decode(errors='ignore').split('\0'):
                        if part.startswith("DBUS_SESSION_BUS_ADDRESS="):
                            env["DBUS_SESSION_BUS_ADDRESS"] = part.split("=", 1)[1]
                            break
            except Exception:
                pass

    # Use notify-send on Linux Desktop to display the notification
    # -u normal = normal urgency, -i phone = phone icon if available
    command = [
        "notify-send",
        "-a", app_name,
        "-u", "normal",
        "-i", "phone",
        f"📱 {title}",
        body
    ]
    try:
        subprocess.Popen(command, env=env)
        return {"status": "success", "message": "Notification forwarded to desktop"}
    except Exception as e:
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
