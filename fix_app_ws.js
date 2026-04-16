const fs = require('fs');

let code = fs.readFileSync('frontend/App.js', 'utf8');

// Replace DashboardScreen polling
code = code.replace(/useEffect\(\(\) => \{\n    let interval = setInterval\(async \(\) => \{\n      try \{\n        const \{ data \} = await axios\.get\(\\\`\\\$\{API_BASE\}\/metrics\\\`\);\n        setMetrics\(data\);\n      \} catch \(e\) \{\n        console\.error\('Failed to fetch metrics:', e\.message\);\n      \}\n    \}, 2000\);\n    return \(\) => clearInterval\(interval\);\n  \}, \[\]\);/g, 
  `useEffect(() => {
    let ws;
    const connect = () => {
      const wsUrl = API_BASE.replace('http:', 'ws:').replace('https:', 'wss:') + '/ws/metrics';
      ws = new WebSocket(wsUrl);
      ws.onmessage = (e) => {
        setMetrics(JSON.parse(e.data));
      };
      ws.onerror = (e) => console.log('Dashboard WS error');
      ws.onclose = () => setTimeout(connect, 3000); // Reconnect
    };
    connect();
    return () => { if (ws) ws.close(); };
  }, []);`
);

// Replace SystemScreen polling
code = code.replace(/useEffect\(\(\) => \{\n    fetchMetrics\(\);\n    const int = setInterval\(fetchMetrics, 3000\);\n    return \(\) => clearInterval\(int\);\n  \}, \[\]\);\n\n  const fetchMetrics = async \(\) => \{\n    try \{\n      const \{ data \} = await axios\.get\(\\\`\\\$\{API_BASE\}\/metrics\\\`\);\n      setMetrics\(data\);\n    \} catch \(e\) \{ console\.error\('Error fetching metrics', e\); \}\n  \};/g, 
  `useEffect(() => {
    let ws;
    const connect = () => {
      const wsUrl = API_BASE.replace('http:', 'ws:').replace('https:', 'wss:') + '/ws/metrics';
      ws = new WebSocket(wsUrl);
      ws.onmessage = (e) => {
        setMetrics(JSON.parse(e.data));
      };
      ws.onerror = (e) => console.log('System WS error');
      ws.onclose = () => setTimeout(connect, 3000);
    };
    connect();
    return () => { if (ws) ws.close(); };
  }, []);`
);

fs.writeFileSync('frontend/App.js', code);
