const fs = require('fs');
let code = fs.readFileSync('frontend/App.js', 'utf-8');

if (!code.includes('expo-notifications')) {
  // Add imports
  code = code.replace(
    /import \{ WebView \} from 'react-native-webview';/,
    "import { WebView } from 'react-native-webview';\nimport * as Notifications from 'expo-notifications';\nimport * as Device from 'expo-device';\nimport Constants from 'expo-constants';"
  );

  // Setup Notification Handler
  const notifSetup = `
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerForPushNotificationsAsync() {
  let token;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return null;
    }
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? 'dummy-project-id';
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  }
  return token;
}
`;
  code = code.replace(/const Tab = createBottomTabNavigator\(\);/, notifSetup + "\nconst Tab = createBottomTabNavigator();");

  // Modify App to call register
  const appReplacement = `export default function App() {
  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        axios.post(\`\${API_BASE}/push/register\`, { token }).catch(e => console.log('Failed to post token'));
      }
    });
  }, []);

  return (`;
  code = code.replace(/export default function App\(\) \{\n  return \(/, appReplacement);
  
  // also add Platform to imports
  code = code.replace(/import \{ View, Text/, "import { View, Text, Platform");

  fs.writeFileSync('frontend/App.js', code);
}
