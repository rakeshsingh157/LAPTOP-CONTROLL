const fs = require('fs');
let code = fs.readFileSync('frontend/App.js', 'utf-8');

// Remove the faulty expo-notifications since Expo Go SDK 53 removed them
code = code.replace(/import \* as Notifications from 'expo-notifications';\n/, '');
code = code.replace(/import \* as Device from 'expo-device';\n/, '');
code = code.replace(/import Constants from 'expo-constants';\n/, '');

// Remove the Notifications.setNotificationHandler array and function entirely
const notifCodeStart = code.indexOf('Notifications.setNotificationHandler');
const notifCodeEnd = code.indexOf('const Tab = createBottomTabNavigator();');
if (notifCodeStart !== -1 && notifCodeEnd !== -1) {
  code = code.slice(0, notifCodeStart) + code.slice(notifCodeEnd);
}

// Update the App component to not call push register
const appComp = `export default function App() {
  return (`;
code = code.replace(/export default function App\(\) \{\n  useEffect\(\(\) => \{[\s\S]*?\}, \[\]\);\n\n  return \(/, appComp);

// Now update DashboardScreen from statically written stuff to dynamically load via useEffect
const newDashboard = `function DashboardScreen() {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    let interval = setInterval(async () => {
      try {
        const { data } = await axios.get(\`\${API_BASE}/metrics\`);
        setMetrics(data);
      } catch (e) {
        console.error('Failed to fetch metrics:', e.message);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds) => {
    if (!seconds) return '0s';
    const d = Math.floor(seconds / (3600*24));
    const h = Math.floor(seconds % (3600*24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const s = Math.floor(seconds % 60);
    return \`\${d}d \${h}h \${m}m \${s}s\`;
  };

  return (
    <SafeAreaView style={tw\`flex-1 bg-surface-dim\`}>
      <ScrollView contentContainerStyle={tw\`p-6 pt-10\`}>
        <View style={tw\`flex-row items-center justify-between mb-2\`}>
            <Text style={tw\`text-3xl font-bold text-on-surface\`}>System Overview</Text>
            {metrics && (
                <View style={tw\`bg-primary-container px-2 py-1 rounded-sm\`}>
                    <Text style={tw\`text-on-primary-container text-xs font-bold uppercase\`}>{metrics.os}</Text>
                </View>
            )}
        </View>
        <Text style={tw\`text-outline mb-6 font-mono text-sm\`}>
          Active Uptime: {metrics ? formatUptime(metrics.uptime) : 'Connecting...'}
        </Text>
        
        <View style={tw\`flex-row gap-3 mb-8\`}>
          <TouchableOpacity style={tw\`bg-surface-container px-4 py-2 rounded-md\`}>
            <Text style={tw\`text-on-surface text-xs font-bold tracking-widest\`}>GENERATE REPORT</Text>
          </TouchableOpacity>
        </View>

        {/* Custom Core Card */}
        <View style={tw\`bg-surface-container-low p-6 rounded-md mb-6\`}>
          <View style={tw\`flex-row items-center justify-between mb-4\`}>
            <Text style={tw\`text-on-surface text-xs font-bold tracking-widest\`}>CPU UTILIZATION</Text>
            <Activity color={tw.color('outline')} size={16} />
          </View>
          <Text style={tw\`text-4xl text-on-surface font-bold tracking-wider\`}>
            {metrics ? metrics.cpu_usage.toFixed(1) : '--'}<Text style={tw\`text-lg text-outline\`}>%</Text>
          </Text>
        </View>

        <View style={tw\`bg-surface-container-low p-6 rounded-md mb-6\`}>
          <View style={tw\`flex-row items-center justify-between mb-4\`}>
            <Text style={tw\`text-secondary text-xs font-bold tracking-widest\`}>MEMORY ALLOCATION</Text>
          </View>
          <Text style={tw\`text-4xl text-on-surface font-bold tracking-wider\`}>
            {metrics ? (metrics.ram_usage.used / 1e9).toFixed(1) : '--'} <Text style={tw\`text-lg text-outline\`}>GB</Text>
          </Text>
          {metrics && (
              <Text style={tw\`text-outline text-xs mt-2\`}>Total: {(metrics.ram_usage.total / 1e9).toFixed(1)} GB ({metrics.ram_usage.percent}% Used)</Text>
          )}
        </View>
        
        <View style={tw\`bg-surface-container-low p-6 rounded-md mb-6\`}>
          <View style={tw\`flex-row items-center justify-between mb-4\`}>
            <Text style={tw\`text-secondary text-xs font-bold tracking-widest\`}>STORAGE</Text>
          </View>
          <Text style={tw\`text-4xl text-on-surface font-bold tracking-wider\`}>
            {metrics ? (metrics.disk_usage.used / 1e9).toFixed(1) : '--'} <Text style={tw\`text-lg text-outline\`}>GB</Text>
          </Text>
          {metrics && (
              <Text style={tw\`text-outline text-xs mt-2\`}>Total: {(metrics.disk_usage.total / 1e9).toFixed(1)} GB ({metrics.disk_usage.percent}% Used)</Text>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}`;

code = code.replace(/function DashboardScreen\(\) \{[\s\S]*?function SystemScreen/, newDashboard + "\n\nfunction SystemScreen");

fs.writeFileSync('frontend/App.js', code);
