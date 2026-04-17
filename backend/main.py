import os
import json
import urllib.request

# Ensure X11/Wayland tools can connect properly from the systemd service.
if not os.environ.get("DISPLAY"):
    os.environ["DISPLAY"] = ":0"
if not os.environ.get("XAUTHORITY"):
    os.environ["XAUTHORITY"] = "/home/rakesh-singh/.Xauthority"

# Fix systemd stripping PATH / audio / dbus environment
_uid = os.getuid()
if _uid == 0:
    _uid = 1000
if not os.environ.get("PATH") or "/usr/bin" not in os.environ["PATH"]:
    os.environ["PATH"] = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin:/home/rakesh-singh/.local/bin"
if not os.environ.get("XDG_RUNTIME_DIR"):
    os.environ["XDG_RUNTIME_DIR"] = f"/run/user/{_uid}"
if not os.environ.get("DBUS_SESSION_BUS_ADDRESS"):
    os.environ["DBUS_SESSION_BUS_ADDRESS"] = f"unix:path=/run/user/{_uid}/bus"
if not os.environ.get("PULSE_SERVER"):
    os.environ["PULSE_SERVER"] = f"unix:/run/user/{_uid}/pulse/native"

from fastapi import FastAPI

from fastapi.middleware.cors import CORSMiddleware
from routes import system, notifications, screen_share, input_control

app = FastAPI(title="Stitch Cloud Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(system.router, prefix="/api/system", tags=["System & Terminal"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(screen_share.router, prefix="/api/share", tags=["Screen Share WebSocket"])
app.include_router(input_control.router, prefix="/api/input", tags=["Remote Control"])


@app.on_event("startup")
def startup_event():
    token_file = "push_token.txt"
    if os.path.exists(token_file):
        try:
            with open(token_file, "r") as f:
                token = f.read().strip()
            if token:
                data = json.dumps({
                    "to": token,
                    "title": "🟢 System Online!",
                    "body": "Your PC is now turned on and running the Stitch Dash.",
                    "sound": "default",
                    "priority": "high"
                }).encode("utf-8")
                
                req = urllib.request.Request(
                    "https://exp.host/--/api/v2/push/send",
                    data=data,
                    headers={
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                )
                urllib.request.urlopen(req)
        except Exception as e:
            print("Failed to send push notification on startup:", e)

@app.on_event("shutdown")
def shutdown_event():
    token_file = "push_token.txt"
    if os.path.exists(token_file):
        try:
            with open(token_file, "r") as f:
                token = f.read().strip()
            if token:
                data = json.dumps({
                    "to": token,
                    "title": "🔴 System Offline",
                    "body": "Your PC dashboard has been shut down.",
                    "sound": "default",
                    "priority": "high"
                }).encode("utf-8")
                
                req = urllib.request.Request(
                    "https://exp.host/--/api/v2/push/send",
                    data=data,
                    headers={
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                )
                urllib.request.urlopen(req)
        except Exception as e:
            print("Failed to send push notification on shutdown:", e)

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Stitch Dashboard Operational"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=62007)
