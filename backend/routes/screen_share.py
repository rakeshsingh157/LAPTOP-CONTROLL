from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from typing import Dict, List
import asyncio
import subprocess
import os

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, list] = {}

    async def connect(self, ws: WebSocket, room_id: str):
        await ws.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(ws)

    def disconnect(self, ws: WebSocket, room_id: str):
        if room_id in self.active_connections:
            if ws in self.active_connections[room_id]:
                self.active_connections[room_id].remove(ws)
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    async def broadcast_to_room(self, message: str, room_id: str, sender: WebSocket):
        for connection in self.active_connections.get(room_id, []):
            if connection != sender:
                try:
                    await connection.send_text(message)
                except Exception:
                    pass

manager = ConnectionManager()


@router.websocket("/ws/screen/{room_id}")
async def screen_share_endpoint(websocket: WebSocket, room_id: str):
    """
    WebRTC Signaling Endpoint
    Both Phone and Desktop viewer connect here to exchange ICE candidates and SDP offers/answers.
    """
    await manager.connect(websocket, room_id)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast_to_room(data, room_id, websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)


@router.get("/phone-stream/adb-status")
def check_adb_status():
    """Check if an Android device is connected via ADB."""
    try:
        result = subprocess.run(
            ["adb", "devices"], capture_output=True, text=True, timeout=5
        )
        lines = result.stdout.strip().split("\n")
        # Parse connected devices (skip header line)
        devices = []
        for line in lines[1:]:
            parts = line.strip().split("\t")
            if len(parts) == 2 and parts[1] == "device":
                # Get device model name
                model_result = subprocess.run(
                    ["adb", "-s", parts[0], "shell", "getprop", "ro.product.model"],
                    capture_output=True, text=True, timeout=5
                )
                model = model_result.stdout.strip() or parts[0]
                devices.append({"serial": parts[0], "model": model})
        return {
            "connected": len(devices) > 0,
            "devices": devices,
            "scrcpy_available": os.path.exists("/tmp/scrcpy-linux-x86_64-v3.2/scrcpy")
        }
    except Exception as e:
        return {"connected": False, "devices": [], "error": str(e)}


@router.get("/phone-stream/start/{room_id}")
def notify_desktop_open_viewer(room_id: str):
    """
    Called by the phone app when sharing starts.
    Launches scrcpy to mirror the phone screen on desktop.
    Uses ADB screen capture which works on all Android devices
    (bypasses Tecno/Transsion ROM MediaProjection restrictions).
    """
    try:
        env = os.environ.copy()
        env["DISPLAY"] = ":0"
        env.setdefault("XAUTHORITY", os.path.expanduser("~/.Xauthority"))
        # Launch scrcpy with optimized settings for screen mirroring
        subprocess.Popen(
            [
                "/tmp/scrcpy-linux-x86_64-v3.2/scrcpy",
                "--window-title=Phone Mirror",
                "--max-size=1024",
                "--max-fps=30",
                "--no-audio",
            ],
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        return {"success": True, "message": "scrcpy mirror launched on desktop"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("/phone-stream/scrcpy-status")
def check_scrcpy_running():
    """Check if scrcpy is currently running."""
    try:
        result = subprocess.run(["pgrep", "-f", "scrcpy"], capture_output=True, text=True)
        running = result.returncode == 0
        return {"running": running}
    except Exception:
        return {"running": False}


@router.get("/phone-stream/stop/{room_id}")
def notify_stream_stopped(room_id: str):
    """Called by phone when sharing stops. Kills any running scrcpy."""
    try:
        subprocess.run(["pkill", "-f", "scrcpy-linux"], capture_output=True)
    except Exception:
        pass
    return {"success": True}


@router.get("/phone-viewer/{room_id}", response_class=HTMLResponse)
def phone_viewer_page(room_id: str):
    """
    Self-contained HTML page that connects to the WebRTC signaling WebSocket 
    and displays the phone screen using a native <video> element via WebRTC.
    Forces VP8 codec via setCodecPreferences + SDP munging fallback.
    Includes watchdog to re-request offer if no frames arrive.
    """
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Phone Screen — Live WebRTC</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{
    font-family: 'Inter', sans-serif;
    background: #0a0a0f;
    color: #e0e0e0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    overflow: hidden;
  }}
  .header {{
    position: fixed; top: 0; left: 0; right: 0;
    padding: 12px 24px;
    display: flex; align-items: center; justify-content: space-between;
    background: rgba(10, 10, 15, 0.85);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    z-index: 100;
  }}
  .header-left {{ display: flex; align-items: center; gap: 12px; }}
  .status-dot {{
    width: 10px; height: 10px; border-radius: 50%;
    background: #22c55e; box-shadow: 0 0 8px #22c55e;
    animation: pulse 2s infinite;
  }}
  .status-dot.offline {{ background: #ef4444; box-shadow: 0 0 8px #ef4444; }}
  .status-dot.warning {{ background: #f59e0b; box-shadow: 0 0 8px #f59e0b; }}
  @keyframes pulse {{ 0%, 100% {{ opacity: 1; }} 50% {{ opacity: 0.5; }} }}
  .title {{ font-size: 14px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #a0a0b0; }}
  .title span {{ color: #818cf8; }}
  .status-text {{ font-size: 12px; color: #6b7280; font-weight: 400; }}
  .screen-container {{
    position: relative; display: flex; align-items: center; justify-content: center;
    width: 100vw; height: 100vh; padding: 60px 20px 20px 20px;
  }}
  #phone-screen {{
    max-width: 100%; max-height: 100%; object-fit: contain;
    border-radius: 12px;
    box-shadow: 0 0 60px rgba(129, 140, 248, 0.15), 0 4px 30px rgba(0,0,0,0.5);
    background: #000;
  }}
  .waiting {{ display: flex; flex-direction: column; align-items: center; gap: 16px; }}
  .spinner {{
    width: 40px; height: 40px;
    border: 3px solid rgba(129, 140, 248, 0.2); border-top-color: #818cf8;
    border-radius: 50%; animation: spin 1s linear infinite;
  }}
  @keyframes spin {{ to {{ transform: rotate(360deg); }} }}
  .waiting-text {{ font-size: 16px; color: #6b7280; }}
  .webrtc-badge {{ font-size: 11px; color: #4b5563; font-family: monospace; background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px; }}
  #debug-panel {{
    position: fixed; bottom: 10px; left: 10px;
    background: rgba(0,0,0,0.9); color: #22c55e;
    font-family: monospace; font-size: 11px;
    padding: 10px 14px; border-radius: 8px;
    border: 1px solid rgba(34,197,94,0.3);
    z-index: 200; line-height: 1.6; min-width: 340px;
    max-width: 500px; white-space: pre-wrap;
  }}
  .btn-retry {{
    position: fixed; bottom: 10px; right: 10px;
    background: #818cf8; color: #fff; border: none;
    padding: 10px 20px; border-radius: 8px; cursor: pointer;
    font-family: 'Inter', sans-serif; font-weight: 600; font-size: 13px;
    z-index: 200;
  }}
  .btn-retry:hover {{ background: #6366f1; }}
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="status-dot offline" id="statusDot"></div>
      <div>
        <div class="title">Phone <span>Mirror</span></div>
        <div class="status-text" id="statusText">Connecting WebRTC...</div>
      </div>
    </div>
    <div class="webrtc-badge">WebRTC Stream</div>
  </div>
  <div class="screen-container" id="container">
    <div class="waiting" id="waitingMsg">
      <div class="spinner"></div>
      <div class="waiting-text">Waiting for phone WebRTC stream...</div>
    </div>
    <video id="phone-screen" autoplay playsinline muted style="display:none;"></video>
  </div>
  <div id="debug-panel">Initializing...</div>
  <button class="btn-retry" id="btnRetry" style="display:none;" onclick="retryConnection()">Retry Connection</button>
  <script>
    const video = document.getElementById('phone-screen');
    const waitingMsg = document.getElementById('waitingMsg');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const debugPanel = document.getElementById('debug-panel');
    const btnRetry = document.getElementById('btnRetry');
    let ws, pc, candidateQueue = [], statsTimer = null;
    let gotOffer = false, gotFirstFrame = false;
    let viewerReadyInterval = null, noFrameWatchdog = null;
    let lastBytesReceived = 0, noNewBytesCount = 0;
    let retryCount = 0;

    function log(msg) {{ console.log('[Viewer] ' + msg); }}

    // --- Force VP8 in SDP (fallback for browsers without setCodecPreferences) ---
    function forceVP8InSDP(sdp) {{
      if (!sdp) return sdp;
      var lines = sdp.split('\\r\\n');
      var result = [];
      for (var i = 0; i < lines.length; i++) {{
        var line = lines[i];
        if (line.startsWith('m=video')) {{
          var parts = line.split(' ');
          var header = parts.slice(0, 3);
          var payloads = parts.slice(3);
          // Find VP8 payload types
          var vp8PTs = [];
          for (var j = 0; j < lines.length; j++) {{
            var m = lines[j].match(/^a=rtpmap:(\\d+)\\s+VP8\\//i);
            if (m) vp8PTs.push(m[1]);
          }}
          if (vp8PTs.length > 0) {{
            // Also keep RTX associated with VP8
            var vp8RTX = [];
            for (var j = 0; j < lines.length; j++) {{
              var m = lines[j].match(/^a=fmtp:(\\d+)\\s+apt=(\\d+)/);
              if (m && vp8PTs.indexOf(m[2]) >= 0) vp8RTX.push(m[1]);
            }}
            var preferred = vp8PTs.concat(vp8RTX);
            var rest = payloads.filter(function(p) {{ return preferred.indexOf(p) < 0; }});
            result.push(header.join(' ') + ' ' + preferred.concat(rest).join(' '));
            log('VP8 forced in SDP, PTs: ' + vp8PTs.join(','));
          }} else {{
            result.push(line);
          }}
        }} else {{
          result.push(line);
        }}
      }}
      return result.join('\\r\\n');
    }}

    function startStats() {{
      if (statsTimer) clearInterval(statsTimer);
      statsTimer = setInterval(async function() {{
        if (!pc) return;
        try {{
          var stats = await pc.getStats();
          var info = '';
          var currentBytes = 0;
          stats.forEach(function(report) {{
            if (report.type === 'inbound-rtp' && report.kind === 'video') {{
              info += 'Frames decoded: ' + (report.framesDecoded || 0) + '\\n';
              info += 'Frames received: ' + (report.framesReceived || 0) + '\\n';
              info += 'Frames dropped: ' + (report.framesDropped || 0) + '\\n';
              info += 'Bytes received: ' + (report.bytesReceived || 0) + '\\n';
              info += 'Packets lost: ' + (report.packetsLost || 0) + '\\n';
              info += 'Resolution: ' + (report.frameWidth || '?') + 'x' + (report.frameHeight || '?') + '\\n';
              info += 'FPS: ' + (report.framesPerSecond || '?') + '\\n';
              currentBytes = report.bytesReceived || 0;
              if (report.framesDecoded > 0 && !gotFirstFrame) {{
                gotFirstFrame = true;
                statusDot.classList.remove('offline', 'warning');
                statusText.textContent = 'Streaming Live';
                btnRetry.style.display = 'none';
                log('First frame decoded!');
              }}
            }}
            if (report.type === 'codec' && report.mimeType && report.mimeType.indexOf('video') === 0) {{
              info += 'Codec: ' + report.mimeType + '\\n';
            }}
          }});
          info += 'Video: ' + video.videoWidth + 'x' + video.videoHeight + '\\n';
          info += 'readyState: ' + video.readyState + ' paused: ' + video.paused + '\\n';
          info += 'connState: ' + (pc ? pc.connectionState : 'none') + '\\n';
          info += 'iceState: ' + (pc ? pc.iceConnectionState : 'none') + '\\n';
          if (video.srcObject) {{
            var tracks = video.srcObject.getVideoTracks();
            for (var i = 0; i < tracks.length; i++) {{
              info += 'Track[' + i + ']: enabled=' + tracks[i].enabled + ' state=' + tracks[i].readyState + '\\n';
              var settings = tracks[i].getSettings ? tracks[i].getSettings() : {{}};
              if (settings.width) info += 'TrackRes: ' + settings.width + 'x' + settings.height + '\\n';
            }}
          }}
          // No-bytes watchdog
          if (currentBytes === lastBytesReceived && gotOffer) {{
            noNewBytesCount++;
            info += '\\n⚠ No new bytes for ' + noNewBytesCount + 's';
            if (noNewBytesCount >= 8 && !gotFirstFrame) {{
              info += '\\n⚠ Stream stalled - click Retry';
              statusDot.classList.remove('offline');
              statusDot.classList.add('warning');
              statusText.textContent = 'No frames received - try Retry';
              btnRetry.style.display = 'block';
            }}
          }} else {{
            noNewBytesCount = 0;
          }}
          lastBytesReceived = currentBytes;
          debugPanel.innerText = info || 'No video stats yet';
        }} catch(e) {{
          debugPanel.innerText = 'Stats error: ' + e.message;
        }}
      }}, 1000);
    }}

    function initWebRTC() {{
      if (pc) {{ try {{ pc.close(); }} catch(e) {{}} }}
      candidateQueue = [];
      gotOffer = false;
      gotFirstFrame = false;
      noNewBytesCount = 0;
      lastBytesReceived = 0;

      pc = new RTCPeerConnection({{
        iceServers: [
          {{ urls: 'stun:stun.l.google.com:19302' }},
          {{ 
            urls: 'turn:127.0.0.1:3478',
            username: 'screen',
            credential: 'share123'
          }}
        ],
        iceTransportPolicy: 'relay'
      }});
      log('PeerConnection created (relay mode via local TURN)');

      pc.ontrack = function(event) {{
        log('ontrack: ' + event.track.kind + ' enabled=' + event.track.enabled + ' state=' + event.track.readyState);
        log('ontrack streams: ' + (event.streams ? event.streams.length : 0));
        var stream;
        if (event.streams && event.streams[0]) {{
          stream = event.streams[0];
        }} else {{
          stream = new MediaStream([event.track]);
        }}
        log('Stream videoTracks: ' + stream.getVideoTracks().length);

        // Always reassign to ensure the video element picks up the track
        video.srcObject = null;
        video.srcObject = stream;
        video.style.display = 'block';
        waitingMsg.style.display = 'none';
        statusDot.classList.remove('offline');
        statusDot.classList.add('warning');
        statusText.textContent = 'Track received - waiting for frames...';
        video.muted = true;

        // Force play with retry
        var playAttempts = 0;
        function tryPlay() {{
          video.play().then(function() {{
            log('play() succeeded');
          }}).catch(function(e) {{
            log('play() error: ' + e.message);
            playAttempts++;
            if (playAttempts < 5) {{
              setTimeout(tryPlay, 500);
            }}
          }});
        }}
        tryPlay();

        event.track.onmute = function() {{ log('Track MUTED'); }};
        event.track.onunmute = function() {{
          log('Track UNMUTED');
          // Re-trigger play on unmute
          tryPlay();
        }};
        event.track.onended = function() {{
          log('Track ENDED');
          statusDot.classList.add('offline');
          statusText.textContent = 'Stream ended';
        }};
        startStats();
      }};

      pc.onicecandidate = function(event) {{
        if (event.candidate) {{
          log('ICE: ' + event.candidate.candidate.substring(0, 50));
          if (ws && ws.readyState === WebSocket.OPEN) {{
            ws.send(JSON.stringify({{ type: 'candidate', candidate: event.candidate, from: 'browser' }}));
          }}
        }} else {{
          log('ICE gathering complete');
        }}
      }};

      pc.onconnectionstatechange = function() {{
        log('connState: ' + pc.connectionState);
        if (pc.connectionState === 'connected') {{
          statusDot.classList.remove('offline');
          if (!gotFirstFrame) {{
            statusDot.classList.add('warning');
            statusText.textContent = 'Connected - waiting for first frame...';
          }} else {{
            statusDot.classList.remove('warning');
            statusText.textContent = 'Streaming Live';
          }}
        }}
        if (pc.connectionState === 'failed') {{
          log('Connection FAILED - will retry');
          statusDot.classList.add('offline');
          statusDot.classList.remove('warning');
          statusText.textContent = 'Connection failed';
          btnRetry.style.display = 'block';
        }}
        if (pc.connectionState === 'closed') {{
          video.style.display = 'none';
          waitingMsg.style.display = 'flex';
          statusDot.classList.add('offline');
          video.srcObject = null;
          if (statsTimer) clearInterval(statsTimer);
        }}
      }};

      pc.oniceconnectionstatechange = function() {{
        log('iceState: ' + pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {{
          statusDot.classList.remove('offline');
        }}
        if (pc.iceConnectionState === 'failed') {{
          log('ICE FAILED');
          btnRetry.style.display = 'block';
        }}
      }};

      pc.onsignalingstatechange = function() {{
        log('signalingState: ' + pc.signalingState);
      }};
    }}

    function retryConnection() {{
      log('=== RETRY CONNECTION ===');
      retryCount++;
      btnRetry.style.display = 'none';
      statusText.textContent = 'Retrying... (attempt ' + retryCount + ')';
      statusDot.classList.add('offline');
      statusDot.classList.remove('warning');
      if (pc) {{ try {{ pc.close(); }} catch(e) {{}} }}
      if (statsTimer) clearInterval(statsTimer);
      if (viewerReadyInterval) clearInterval(viewerReadyInterval);
      initWebRTC();
      // Re-request offer from phone
      if (ws && ws.readyState === WebSocket.OPEN) {{
        ws.send(JSON.stringify({{ type: 'viewer_ready', from: 'browser' }}));
      }}
      // Set up periodic re-request
      setupViewerReadyPing();
    }}

    function setupViewerReadyPing() {{
      if (viewerReadyInterval) clearInterval(viewerReadyInterval);
      var pingCount = 0;
      viewerReadyInterval = setInterval(function() {{
        if (gotOffer) {{
          clearInterval(viewerReadyInterval);
          return;
        }}
        pingCount++;
        if (pingCount > 12) {{ // Stop after 60s
          clearInterval(viewerReadyInterval);
          return;
        }}
        log('Re-sending viewer_ready (ping ' + pingCount + ')');
        if (ws && ws.readyState === WebSocket.OPEN) {{
          ws.send(JSON.stringify({{ type: 'viewer_ready', from: 'browser' }}));
        }}
      }}, 5000);
    }}

    function connect() {{
      var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(proto + '//' + location.host + '/api/share/ws/screen/{room_id}');

      ws.onopen = function() {{
        log('WS connected');
        statusText.textContent = 'Connected — waiting for phone stream...';
        initWebRTC();
        ws.send(JSON.stringify({{ type: 'viewer_ready', from: 'browser' }}));
        setupViewerReadyPing();
      }};

      ws.onmessage = async function(event) {{
        try {{
          var msg = JSON.parse(event.data);
          if (msg.from === 'browser') return;

          if (msg.type === 'offer' && msg.offer) {{
            gotOffer = true;
            if (viewerReadyInterval) clearInterval(viewerReadyInterval);
            log('Got offer, SDP len=' + (msg.offer.sdp || '').length);
            statusText.textContent = 'Got offer, negotiating...';

            // If we already set remote/local desc (re-offer), we need to reset PC
            if (pc.signalingState !== 'stable' && pc.signalingState !== 'have-remote-offer') {{
              log('Resetting PC for re-offer, was: ' + pc.signalingState);
              initWebRTC();
            }}

            await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
            log('Remote desc set, signalingState=' + pc.signalingState);

            // Drain candidate queue
            for (var i = 0; i < candidateQueue.length; i++) {{
              try {{ await pc.addIceCandidate(new RTCIceCandidate(candidateQueue[i])); }} catch(e) {{}}
            }}
            candidateQueue = [];

            var answer = await pc.createAnswer();

            // Force VP8 in the answer SDP as fallback
            var modifiedSdp = forceVP8InSDP(answer.sdp);
            var modifiedAnswer = {{ type: answer.type, sdp: modifiedSdp }};

            await pc.setLocalDescription(modifiedAnswer);
            log('Local desc set (VP8-forced answer)');

            ws.send(JSON.stringify({{ type: 'answer', answer: modifiedAnswer, from: 'browser' }}));
            log('Answer sent');
          }}
          else if (msg.type === 'candidate' && msg.candidate) {{
            if (pc.remoteDescription) {{
              try {{
                await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
              }} catch(e) {{
                log('addIceCandidate error: ' + e.message);
              }}
            }} else {{
              candidateQueue.push(msg.candidate);
            }}
          }}
        }} catch(e) {{
          log('Error: ' + e.message + '\\n' + e.stack);
          debugPanel.innerText = 'ERROR: ' + e.message;
        }}
      }};

      ws.onclose = function() {{
        log('WS closed');
        statusDot.classList.add('offline');
        statusDot.classList.remove('warning');
        statusText.textContent = 'Disconnected — reconnecting...';
        if (pc) {{ try {{ pc.close(); }} catch(e) {{}} }}
        pc = null;
        gotOffer = false;
        gotFirstFrame = false;
        if (statsTimer) clearInterval(statsTimer);
        if (viewerReadyInterval) clearInterval(viewerReadyInterval);
        setTimeout(connect, 2000);
      }};

      ws.onerror = function() {{
        log('WS error');
      }};
    }}

    connect();
  </script>
</body>
</html>"""
    return HTMLResponse(content=html)
