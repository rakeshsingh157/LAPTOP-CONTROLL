from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json
from pynput.mouse import Controller as MouseController, Button
from pynput.keyboard import Controller as KeyboardController, Key, KeyCode

router = APIRouter()

mouse = MouseController()
keyboard = KeyboardController()

# Map string representations from frontend to pynput keys
KEY_MAP = {
    'enter': Key.enter,
    'backspace': Key.backspace,
    'tab': Key.tab,
    'escape': Key.esc,
    'up': Key.up,
    'down': Key.down,
    'left': Key.left,
    'right': Key.right,
    'home': Key.home,
    'end': Key.end,
    'pageup': Key.page_up,
    'pagedown': Key.page_down,
    'delete': Key.delete,
    'space': Key.space,
    'shift': Key.shift,
    'ctrl': Key.ctrl,
    'alt': Key.alt,
    'win': Key.cmd,
    'capslock': Key.caps_lock,
    'f1': Key.f1, 'f2': Key.f2, 'f3': Key.f3, 'f4': Key.f4,
    'f5': Key.f5, 'f6': Key.f6, 'f7': Key.f7, 'f8': Key.f8,
    'f9': Key.f9, 'f10': Key.f10, 'f11': Key.f11, 'f12': Key.f12,
}

@router.websocket("/ws/input/{room_id}")
async def websocket_input_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()
    
    # Store state to handle dragging
    drag_active = False

    try:
        while True:
            data = await websocket.receive_text()
            try:
                cmd = json.loads(data)
                type = cmd.get("type")

                # MOUSE EVENTS
                if type == "mouse_move":
                    dx = cmd.get("dx", 0)
                    dy = cmd.get("dy", 0)
                    mouse.move(dx, dy)
                elif type == "mouse_click":
                    button_str = cmd.get("button", "left")
                    button = Button.right if button_str == "right" else Button.left
                    mouse.click(button, 1)
                elif type == "mouse_down":
                    button_str = cmd.get("button", "left")
                    button = Button.right if button_str == "right" else Button.left
                    mouse.press(button)
                    drag_active = True
                elif type == "mouse_up":
                    button_str = cmd.get("button", "left")
                    button = Button.right if button_str == "right" else Button.left
                    mouse.release(button)
                    drag_active = False
                elif type == "mouse_scroll":
                    sx = cmd.get("sx", 0)
                    sy = cmd.get("sy", 0)
                    mouse.scroll(sx, sy)

                # KEYBOARD EVENTS
                elif type in ["key_press", "key_down", "key_up"]:
                    key_val = cmd.get("key")
                    if not key_val:
                        continue
                    
                    target_key = None
                    if key_val.lower() in KEY_MAP:
                        target_key = KEY_MAP[key_val.lower()]
                    elif len(key_val) == 1:
                        target_key = key_val
                    
                    if target_key is not None:
                        if type == "key_down":
                            keyboard.press(target_key)
                        elif type == "key_up":
                            keyboard.release(target_key)
                        else:  # key_press
                            keyboard.tap(target_key)
                    elif type == "key_press":
                         keyboard.type(key_val)
                        
            except json.JSONDecodeError:
                pass
            except Exception as e:
                print(f"Error processing input: {e}")

    except WebSocketDisconnect:
        # Cleanup in case disconnected during a drag
        if drag_active:
            mouse.release(Button.left)
        pass
    except Exception as e:
        print(f"Input websocket error: {e}")
