import re

with open('/home/rakesh-singh/Documents/LAPTOP ACCESS/backend/routes/system.py', 'r') as f:
    text = f.read()

imports = """
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from pydantic import BaseModel
import os
import psutil
import subprocess
import shutil
import pyperclip
"""

if "import pyperclip" not in text:
    text = re.sub(r'from fastapi import.*?\n(.*?\n)*?import subprocess\n', imports, text, count=1)

routes = """
class ClipboardData(BaseModel):
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
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/file/upload")
async def upload_file(path: str, file: UploadFile = File(...)):
    try:
        target_path = os.path.join(path, file.filename)
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"success": True, "path": target_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
"""

if "/clipboard" not in text:
    text += "\n" + routes

with open('/home/rakesh-singh/Documents/LAPTOP ACCESS/backend/routes/system.py', 'w') as f:
    f.write(text)
