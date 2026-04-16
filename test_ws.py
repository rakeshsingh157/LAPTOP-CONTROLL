import asyncio
import websockets
import json

async def test():
    try:
        async with websockets.connect("ws://localhost:62007/api/system/ws/screen") as ws:
            print("Connected.")
            await ws.send(json.dumps({"action": "key", "key": "t", "modifiers": {"ctrl": True, "alt": True, "win": False, "shift": False}}))
            print("Sent Ctrl+Alt+T")
            await asyncio.sleep(1)
            
            await ws.send(json.dumps({"action": "key", "key": "h", "modifiers": {"ctrl": False, "alt": False, "win": True, "shift": False}}))
            print("Sent Win+H")
            await asyncio.sleep(1)
    except Exception as e:
        print("Error:", e)

asyncio.run(test())
