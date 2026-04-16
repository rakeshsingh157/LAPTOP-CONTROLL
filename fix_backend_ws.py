import urllib.request
import os

with open('backend/routes/system.py', 'r') as f:
    code = f.read()

if 'WebSocket' not in code:
    code = code.replace(
        'from fastapi import APIRouter, Depends, HTTPException',
        'from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect\nimport asyncio'
    )
    
    ws_code = """
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
"""
    code = code + ws_code
    
    with open('backend/routes/system.py', 'w') as f:
        f.write(code)
