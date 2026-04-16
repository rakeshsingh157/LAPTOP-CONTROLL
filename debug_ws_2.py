import re

with open('/home/rakesh-singh/Documents/LAPTOP ACCESS/backend/routes/system.py', 'r') as f:
    t = f.read()

t = t.replace('except Exception as e:\n        print("Outer err:", e)\n        await websocket.close()', 'except Exception as e:\n        import traceback\n        traceback.print_exc()\n        await websocket.close()')
t = t.replace('except Exception as e:\n            print("Inner loop err:", e)', 'except Exception as e:\n            import traceback\n            traceback.print_exc()')
with open('/home/rakesh-singh/Documents/LAPTOP ACCESS/backend/routes/system.py', 'w') as f:
    f.write(t)
