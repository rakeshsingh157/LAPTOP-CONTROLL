const fs = require('fs');

let code = fs.readFileSync('/home/rakesh-singh/Documents/LAPTOP ACCESS/frontend/App.js', 'utf8');

// 1. Add createContext and useContext to React import
code = code.replace(
  "import React, { useState, useEffect, useRef } from 'react';",
  "import React, { useState, useEffect, useRef, createContext, useContext } from 'react';"
);

// 2. Remove hardcoded API_BASE and create context
code = code.replace(
  "const API_BASE = 'http://100.67.104.120:62007/api/system';",
  "const ApiContext = createContext();\n// API_BASE removed"
);

// 3. Update DashboardScreen
const dashboardBefore = `function DashboardScreen() {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
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

const dashboardAfter = `function DashboardScreen() {
  const { apiBase, setApiBase } = useContext(ApiContext);
  const [metrics, setMetrics] = useState(null);
  const [status, setStatus] = useState('checking');
  const [editApi, setEditApi] = useState(false);
  const [tempApi, setTempApi] = useState('');

  useEffect(() => {
    let ws;
    let isActive = true;
    const connect = () => {
      if (!isActive) return;
      setStatus('checking');
      const wsUrl = apiBase.replace('http:', 'ws:').replace('https:', 'wss:') + '/ws/metrics';
      ws = new WebSocket(wsUrl);
      ws.onmessage = (e) => {
        if (isActive) {
          setMetrics(JSON.parse(e.data));
          setStatus('live');
        }
      };
      ws.onerror = (e) => {
        if (isActive) setStatus('down');
      };
      ws.onclose = () => { 
        if (isActive) {
          setStatus('down');
          setTimeout(connect, 3000); 
        }
      };
    };
    connect();
    return () => { isActive = false; if (ws) ws.close(); };
  }, [apiBase]);`;
code = code.replace(dashboardBefore, dashboardAfter);

// 4. Implement edit UI in Dashboard return
const oldHeader = `<View style={tw\`px-6 pt-6 pb-2\`}>
        <Text style={tw\`text-on-surface text-3xl font-black tracking-tight\`}>System<Text style={tw\`text-primary\`}>Dash</Text></Text>
        <Text style={tw\`text-on-surface-variant font-medium mt-1\`}>Live Hardware Metrics</Text>
      </View>`;

const newHeader = `<View style={tw\`px-6 pt-6 pb-2 flex-row justify-between items-start\`}>
        <View>
          <Text style={tw\`text-on-surface text-3xl font-black tracking-tight\`}>System<Text style={tw\`text-primary\`}>Dash</Text></Text>
          <View style={tw\`flex-row items-center mt-2\`}>
            <View style={tw\`w-3 h-3 rounded-full mr-2 \${status === 'live' ? 'bg-green-500' : status === 'checking' ? 'bg-yellow-500' : 'bg-red-500'}\`} />
            <Text style={tw\`text-on-surface-variant font-medium\`}>
              {status === 'live' ? 'Online & Live' : status === 'checking' ? 'Connecting...' : 'Offline / Down'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => { setTempApi(apiBase); setEditApi(true); }} style={tw\`bg-surface-dim p-3 rounded-full\`}>
          <Activity size={20} color={tw.color('on-surface')} />
        </TouchableOpacity>
      </View>

      <Modal visible={editApi} transparent={true} animationType="fade">
        <View style={tw\`flex-1 justify-center items-center bg-black/80 px-6\`}>
          <View style={tw\`bg-surface-container w-full p-6 rounded-lg\`}>
            <Text style={tw\`text-on-surface font-bold text-lg mb-4\`}>Server API URL</Text>
            <TextInput
              style={tw\`bg-surface-dim p-4 text-on-surface font-mono rounded-md mb-4\`}
              value={tempApi}
              onChangeText={setTempApi}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={tw\`flex-row justify-end gap-3\`}>
              <TouchableOpacity onPress={() => setEditApi(false)} style={tw\`px-4 py-2\`}>
                <Text style={tw\`text-on-surface\`}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setApiBase(tempApi); setEditApi(false); }} style={tw\`bg-primary px-4 py-2 rounded-md\`}>
                <Text style={tw\`text-on-primary font-bold\`}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>`;

code = code.replace(oldHeader, newHeader);


// 5. Replace Terminal API_BASE
code = code.replace(
  "function TerminalScreen() {",
  "function TerminalScreen() {\n  const { apiBase } = useContext(ApiContext);"
);

// 6. Replace Files API_BASE
code = code.replace(
  "function FilesScreen() {",
  "function FilesScreen() {\n  const { apiBase } = useContext(ApiContext);"
);

// 7. Inject default export context wrap
const oldApp = `export default function App() {
  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {`;

const newApp = `export default function App() {
  const [apiBase, setApiBase] = useState('http://100.67.104.120:62007/api/system');

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {`;

code = code.replace(oldApp, newApp);

const oldNav = `  return (
    <NavigationContainer theme={MyTheme}>`;

const newNav = `  return (
    <ApiContext.Provider value={{ apiBase, setApiBase }}>
      <NavigationContainer theme={MyTheme}>`;

code = code.replace(oldNav, newNav);

const navEnd = `      </Tab.Navigator>
    </NavigationContainer>
  );
}`;

const newNavEnd = `      </Tab.Navigator>
    </NavigationContainer>
    </ApiContext.Provider>
  );
}`;
code = code.replace(navEnd, newNavEnd);

// Replace remaining individual calls
while(code.includes("API_BASE")) {
  code = code.replace("API_BASE", "apiBase");
}

fs.writeFileSync('/home/rakesh-singh/Documents/LAPTOP ACCESS/frontend/App.js', code);
