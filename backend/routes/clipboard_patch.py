import re

with open('/home/rakesh-singh/Documents/LAPTOP ACCESS/backend/routes/system.py', 'r') as f:
    text = f.read()

imports = """
import tempfile
import base64
"""

if "import base64" not in text:
    text = text.replace("import pyperclip", "import pyperclip\nimport tempfile\nimport base64\n")


old_routes = """class ClipboardData(BaseModel):
    text: str

@router.get("/clipboard")
def get_clipboard():
    try:
        return {"text": pyperclip.paste()}
    except Exception as e:
        return {"text": "", "error": str(e)}

@router.post("/clipboard")
def set_clipboard(data: ClipboardData):
    try:
        pyperclip.copy(data.text)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))"""

new_routes = """class ClipboardData(BaseModel):
    type: str # 'text' or 'image'
    content: str # plain text or base64 data

@router.get("/clipboard")
def get_clipboard():
    try:
        # Check if it's an image
        res_targets = subprocess.run(['xclip', '-selection', 'clipboard', '-t', 'TARGETS', '-o'], capture_output=True, text=True)
        if "image/png" in res_targets.stdout or "image/" in res_targets.stdout:
            res_img = subprocess.run(['xclip', '-selection', 'clipboard', '-t', 'image/png', '-o'], capture_output=True)
            if res_img.returncode == 0 and len(res_img.stdout) > 0:
                b64 = base64.b64encode(res_img.stdout).decode('utf-8')
                return {"type": "image", "content": b64}
                
        # Otherwise return text
        return {"type": "text", "content": pyperclip.paste() or ""}
    except Exception as e:
        return {"type": "text", "content": "", "error": str(e)}

@router.post("/clipboard")
def set_clipboard(data: ClipboardData):
    try:
        if data.type == 'image':
            img_bytes = base64.b64decode(data.content)
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
                f.write(img_bytes)
                f.flush()
                subprocess.run(['xclip', '-selection', 'clipboard', '-t', 'image/png', '-i', f.name])
            return {"success": True}
        else:
            pyperclip.copy(data.content)
            return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))"""

if old_routes in text:
    text = text.replace(old_routes, new_routes)

with open('/home/rakesh-singh/Documents/LAPTOP ACCESS/backend/routes/system.py', 'w') as f:
    f.write(text)
