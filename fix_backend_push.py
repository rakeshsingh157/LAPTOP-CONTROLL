const fs = require('fs');
let code = fs.readFileSync('backend/routes/system.py', 'utf-8');

if (!code.includes('/push/register')) {
  const endpoint = `\nclass PushRequest(BaseModel):\n    token: str\n\n@router.post("/push/register")\ndef register_push(req: PushRequest):\n    with open("push_token.txt", "w") as f:\n        f.write(req.token)\n    return {"success": True}\n`;
  code = code + endpoint;
  fs.writeFileSync('backend/routes/system.py', code);
}
