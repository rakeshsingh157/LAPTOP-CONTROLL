with open('/home/rakesh-singh/Documents/LAPTOP ACCESS/backend/routes/system.py', 'r') as f:
    text = f.read()

route_code = """
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
        import asyncio

        mouse = Controller()
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
                    
                    mouse.position = (mx, my)
                    if action == "click":
                        mouse.click(Button.left)
            except Exception as e:
                pass

        task = asyncio.create_task(receive_events())
        
        try:
            while True:
                sct_img = sct.grab(monitor)
                img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")
                # Compress resolution for speed (keeps aspect ratio)
                img.thumbnail((800, 800))
                buffer = io.BytesIO()
                img.save(buffer, format="JPEG", quality=40)
                b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
                
                await websocket.send_text(b64)
                await asyncio.sleep(0.1) # Max ~10 FPS
        except Exception as e:
            pass
        finally:
            task.cancel()
    except Exception as e:
        print("Screen WS startup error:", e)
        await websocket.close()
"""

if "/ws/screen" not in text:
    text += "\n" + route_code
    with open('/home/rakesh-singh/Documents/LAPTOP ACCESS/backend/routes/system.py', 'w') as f:
        f.write(text)
