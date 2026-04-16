const fs = require('fs');
let code = fs.readFileSync('frontend/App.js', 'utf-8');

const dsReplacement = `useEffect(() => {
    let ws;
    let isActive = true;
    const connect = () => {
      if (!isActive) return;
      const wsUrl = API_BASE.replace('http:', 'ws:').replace('https:', 'wss:') + '/ws/metrics';
      ws = new WebSocket(wsUrl);
      ws.onmessage = (e) => {
        if (isActive) setMetrics(JSON.parse(e.data));
      };
      ws.onerror = (e) => console.log('WS Error');
      ws.onclose = () => { if (isActive) setTimeout(connect, 3000); };
    };
    connect();
    return () => { isActive = false; if (ws) ws.close(); };
  }, []);`;

// DashBoard Screen Replace
let parts = code.split('function DashboardScreen() {\n  const [metrics, setMetrics] = useState(null);\n\n  useEffect(() => {\n    let interval = setInterval(async () => {\n      try {\n        const { data } = await axios.get(`${API_BASE}/metrics`);\n        setMetrics(data);\n      } catch (e) {\n        console.error(\'Failed to fetch metrics:\', e.message);\n      }\n    }, 2000);\n    return () => clearInterval(interval);\n  }, []);');
if(parts.length > 1) {
  code = parts[0] + 'function DashboardScreen() {\n  const [metrics, setMetrics] = useState(null);\n\n  ' + dsReplacement + parts[1];
}

// System Screen Replace
parts = code.split('useEffect(() => {\n    fetchMetrics();\n    const int = setInterval(fetchMetrics, 3000);\n    return () => clearInterval(int);\n  }, []);\n\n  const fetchMetrics = async () => {\n    try {\n      const { data } = await axios.get(`${API_BASE}/metrics`);\n      setMetrics(data);\n    } catch (e) { console.error(\'Error fetching metrics\', e); }\n  };');

if(parts.length > 1) {
    code = parts[0] + dsReplacement + parts[1];
}

fs.writeFileSync('frontend/App.js', code);
