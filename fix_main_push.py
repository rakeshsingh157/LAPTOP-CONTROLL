const fs = require('fs');
let code = fs.readFileSync('backend/main.py', 'utf-8');

if (!code.includes('startup')) {
  let imports = `import os\nimport json\nimport urllib.request\nfrom fastapi import FastAPI\n`;
  code = code.replace(/from fastapi import FastAPI/, imports);
  
  let startupCode = `
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
                    "title": "System Online!",
                    "body": "Your PC is now turned on and running the Stitch Dash.",
                    "sound": "default"
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
`;
  code = code.replace(/@app\.get\("\/"\)/, startupCode + '\n@app.get("/")');
  fs.writeFileSync('backend/main.py', code);
}
