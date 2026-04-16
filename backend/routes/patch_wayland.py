import re

with open('/home/rakesh-singh/Documents/LAPTOP ACCESS/backend/routes/system.py', 'r') as f:
    text = f.read()

# Replace the grabbing loop to handle mss exception gracefully and send JSON error overlay.
old_grab_loop = """        try:
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
            import traceback
            traceback.print_exc()
        finally:"""

new_grab_loop = """        try:
            while True:
                try:
                    sct_img = sct.grab(monitor)
                    img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")
                    img.thumbnail((800, 800))
                    buffer = io.BytesIO()
                    img.save(buffer, format="JPEG", quality=40)
                    b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
                    await websocket.send_text(json.dumps({"type": "frame", "data": b64}))
                except Exception as ex:
                    if "XGetImage() failed" in str(ex):
                        await websocket.send_text(json.dumps({
                            "type": "error", 
                            "message": "Wayland Display Blocked.\\n\\nPlease log out of your computer and select 'Ubuntu on Xorg' using the bottom-right gear icon on the login screen to allow Live Remote Desktop."
                        }))
                    else:
                        print("Screen error:", ex)
                    await asyncio.sleep(2)
                    continue
                await asyncio.sleep(0.1)
        except Exception as e:
            pass
        finally:"""

if "await websocket.send_text(json.dumps" not in text:
    text = text.replace(old_grab_loop, new_grab_loop)
    with open('/home/rakesh-singh/Documents/LAPTOP ACCESS/backend/routes/system.py', 'w') as f:
        f.write(text)
