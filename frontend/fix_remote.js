const fs = require('fs');

let code = fs.readFileSync('/home/rakesh-singh/Documents/LAPTOP ACCESS/frontend/App.js', 'utf8');

// 1. Add Monitor import
const oldImport = "import { Home, Activity, Terminal as TerminalIcon, Folder, Download, Upload, Search, ArrowUp, UploadCloud } from 'lucide-react-native';";
const newImport = "import { Home, Activity, Terminal as TerminalIcon, Folder, Download, Upload, Search, ArrowUp, UploadCloud, Monitor } from 'lucide-react-native';";
code = code.replace(oldImport, newImport);

// 2. Add RemoteScreen Component
const remoteScreenCode = `
function RemoteScreen() {
  const { apiBase } = useContext(ApiContext);
  const [frame, setFrame] = useState(null);
  const wsRef = useRef(null);
  const [viewLayout, setViewLayout] = useState(null);

  useEffect(() => {
    let isActive = true;
    const connect = () => {
      if (!isActive) return;
      const wsUrl = apiBase.replace('http:', 'ws:').replace('https:', 'wss:') + '/ws/screen';
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        if (isActive) setFrame(e.data);
      };
      ws.onerror = () => console.log('Screen WS Error');
      ws.onclose = () => { if (isActive) setTimeout(connect, 3000); };
    };
    connect();
    return () => { isActive = false; if(wsRef.current) wsRef.current.close(); };
  }, [apiBase]);

  const handleTouch = (e, isClick = false) => {
    if (!wsRef.current || !viewLayout) return;
    const { locationX, locationY } = e.nativeEvent;
    
    // Stretch resizeMode maps directly to the view size 0-1 range
    const px = Math.max(0, Math.min(1, locationX / viewLayout.width));
    const py = Math.max(0, Math.min(1, locationY / viewLayout.height));
    
    wsRef.current.send(JSON.stringify({
      action: isClick ? 'click' : 'move',
      x: px,
      y: py
    }));
  };

  return (
    <SafeAreaView style={tw\`flex-1 bg-black justify-center items-center\`}>
      {frame ? (
        <View 
          style={{ width: '100%', height: '100%' }}
          onLayout={(e) => setViewLayout(e.nativeEvent.layout)}
          onTouchStart={(e) => handleTouch(e, true)}
          onTouchMove={(e) => handleTouch(e, false)}
        >
          <Image 
            source={{ uri: \`data:image/jpeg;base64,\${frame}\` }} 
            style={{ width: '100%', height: '100%', resizeMode: 'stretch' }}
          />
        </View>
      ) : (
        <View style={tw\`items-center\`}>
          <ActivityIndicator color={tw.color('primary')} size="large" />
          <Text style={tw\`text-primary mt-4 font-mono\`}>Connecting to Display...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

export default function App`;

code = code.replace("export default function App", remoteScreenCode);

// 3. Add to Nav
const newTab = `        <Tab.Screen 
          name="Remote" 
          component={RemoteScreen} 
          options={{ tabBarIcon: ({ color }) => <Monitor color={color} size={24} /> }} 
        />
        <Tab.Screen 
          name="Files"`;
code = code.replace(/<Tab\.Screen \s*name="Files"/, newTab);

fs.writeFileSync('/home/rakesh-singh/Documents/LAPTOP ACCESS/frontend/App.js', code);
