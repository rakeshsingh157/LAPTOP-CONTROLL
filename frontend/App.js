import * as Clipboard from 'expo-clipboard';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { PermissionsAndroid } from 'react-native';
import RNAndroidNotificationListener from 'react-native-android-notification-listener';
import React, { useState, useEffect, createContext, useContext, useRef, useCallback } from 'react';
import { View, Text, Platform, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, NativeModules, Alert, Modal, Linking, Image, StatusBar, PanResponder, Switch } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { NavigationContainer, useFocusEffect } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import axios from 'axios';
import { Home, Activity, Terminal as TerminalIcon, Folder, Download, Upload, Search, ArrowUp, UploadCloud, Monitor , AlertTriangle, X, Camera, RefreshCcw, Smartphone, Mouse, Shield, Zap, Lock } from "lucide-react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mediaDevices, RTCPeerConnection, RTCIceCandidate, RTCSessionDescription } from 'react-native-webrtc';


import { create } from 'twrnc';
const tw = create(require('./tailwind.config.js'));


const Tab = createBottomTabNavigator();

const ApiContext = createContext();
// apiBase removed

function PhoneShareScreen() {
  const { apiBase } = useContext(ApiContext);
  const [isSharing, setIsSharing] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, checking, connecting, streaming, error
  const [adbStatus, setAdbStatus] = useState(null); // null = not checked, object = result
  const [checking, setChecking] = useState(false);
  const ROOM_ID = 'phone_mirror';

  const getHost = () => apiBase.replace('/api/system', '');

  const checkConnection = async () => {
    setChecking(true);
    try {
      const host = getHost();
      const res = await axios.get(`${host}/api/share/phone-stream/adb-status`);
      setAdbStatus(res.data);
    } catch (err) {
      setAdbStatus({ connected: false, devices: [], error: 'Cannot reach desktop server' });
    }
    setChecking(false);
  };

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 8000);
    return () => clearInterval(interval);
  }, [apiBase]);

  // Poll scrcpy running status while mirroring
  useEffect(() => {
    if (!isSharing) return;
    const pollInterval = setInterval(async () => {
      try {
        const host = getHost();
        const res = await axios.get(`${host}/api/share/phone-stream/scrcpy-status`);
        if (!res.data?.running) {
          // scrcpy was closed on desktop
          setIsSharing(false);
          setStatus('idle');
        }
      } catch (e) {}
    }, 3000);
    return () => clearInterval(pollInterval);
  }, [isSharing]);

  const startSharing = async () => {
    setStatus('connecting');
    try {
      const host = getHost();
      const res = await axios.get(`${host}/api/share/phone-stream/start/${ROOM_ID}`);
      if (res.data && res.data.success) {
        setIsSharing(true);
        setStatus('streaming');
      } else {
        throw new Error(res.data?.error || 'Failed to launch mirror');
      }
    } catch (err) {
      setStatus('error');
      Alert.alert("Mirror Error", err.message || "Could not start screen mirror. Make sure the phone is connected via USB.");
      // Auto-clear error after 5 seconds
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  const stopSharing = () => {
    setIsSharing(false);
    setStatus('idle');
    const host = getHost();
    axios.get(`${host}/api/share/phone-stream/stop/${ROOM_ID}`).catch(() => {});
  };

  const isConnected = adbStatus?.connected === true;
  const deviceName = adbStatus?.devices?.[0]?.model || 'Unknown';

  return (
    <View style={tw`flex-1 bg-surface-dim`}>
      <SafeAreaView style={tw`flex-1`}>
        <ScrollView contentContainerStyle={tw`p-5 pb-20`}>
          {/* Header */}
          <View style={tw`bg-surface-container-low p-6 rounded-xl items-center mb-4`}>
            <View style={tw`w-20 h-20 rounded-full items-center justify-center mb-4 ${isSharing ? 'bg-red-500/20' : 'bg-primary/20'}`}>
              <Smartphone color={isSharing ? tw.color('red-400') : tw.color('primary')} size={40} />
            </View>
            <Text style={tw`text-on-surface text-2xl font-bold mb-1`}>Screen Mirror</Text>
            <Text style={tw`text-outline text-sm text-center`}>
              {isSharing ? "Your phone screen is being mirrored on desktop" : "Mirror your phone screen to your desktop via USB"}
            </Text>
          </View>

          {/* Connection Status Card */}
          <View style={tw`bg-surface-container-low p-4 rounded-xl mb-4`}>
            <View style={tw`flex-row items-center justify-between mb-3`}>
              <Text style={tw`text-on-surface font-bold text-base`}>Connection Status</Text>
              <TouchableOpacity onPress={checkConnection} disabled={checking}>
                <RefreshCcw color={tw.color('primary')} size={18} style={checking ? {opacity: 0.4} : {}} />
              </TouchableOpacity>
            </View>

            {adbStatus === null ? (
              <View style={tw`flex-row items-center`}>
                <Activity color={tw.color('outline')} size={16} style={tw`mr-2`} />
                <Text style={tw`text-outline text-sm`}>Checking connection...</Text>
              </View>
            ) : isConnected ? (
              <View>
                <View style={tw`flex-row items-center bg-green-500/10 px-3 py-2 rounded-lg`}>
                  <View style={tw`w-2.5 h-2.5 rounded-full bg-green-500 mr-2`} />
                  <Text style={tw`text-green-400 text-sm font-medium flex-1`}>Connected — {deviceName}</Text>
                  <Monitor color={tw.color('green-400')} size={16} />
                </View>
              </View>
            ) : (
              <View style={tw`bg-red-500/10 px-3 py-2 rounded-lg`}>
                <View style={tw`flex-row items-center`}>
                  <AlertTriangle color={tw.color('red-400')} size={16} style={tw`mr-2`} />
                  <Text style={tw`text-red-400 text-sm font-medium`}>Not Connected via USB</Text>
                </View>
                {adbStatus?.error && (
                  <Text style={tw`text-red-400/60 text-xs mt-1 ml-6`}>{adbStatus.error}</Text>
                )}
              </View>
            )}
          </View>

          {/* Setup Instructions - shown when not connected */}
          {!isConnected && (
            <View style={tw`bg-surface-container-low p-4 rounded-xl mb-4`}>
              <Text style={tw`text-on-surface font-bold text-base mb-3`}>Setup Instructions</Text>
              
              <View style={tw`mb-4`}>
                <Text style={tw`text-primary font-bold text-sm mb-1`}>Step 1: Enable Developer Mode</Text>
                <View style={tw`bg-surface-container pl-3 py-2 rounded-lg`}>
                  <Text style={tw`text-on-surface-variant text-xs leading-5`}>
                    Settings → About Phone → tap "Build Number" 7 times{'\n'}
                    You'll see "You are now a developer!"
                  </Text>
                </View>
              </View>

              <View style={tw`mb-4`}>
                <Text style={tw`text-primary font-bold text-sm mb-1`}>Step 2: Enable USB Debugging</Text>
                <View style={tw`bg-surface-container pl-3 py-2 rounded-lg`}>
                  <Text style={tw`text-on-surface-variant text-xs leading-5`}>
                    Settings → Developer Options → enable "USB Debugging"{'\n'}
                    Tap "OK" on the confirmation dialog
                  </Text>
                </View>
              </View>

              <View style={tw`mb-2`}>
                <Text style={tw`text-primary font-bold text-sm mb-1`}>Step 3: Connect USB Cable</Text>
                <View style={tw`bg-surface-container pl-3 py-2 rounded-lg`}>
                  <Text style={tw`text-on-surface-variant text-xs leading-5`}>
                    Connect your phone to the PC with a USB cable{'\n'}
                    If prompted, tap "Allow USB Debugging" and check{'\n'}
                    "Always allow from this computer"
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Action Button */}
          {isConnected && (
            <View style={tw`bg-surface-container-low p-4 rounded-xl mb-4 items-center`}>
              {status === 'streaming' && (
                <View style={tw`flex-row items-center mb-4 bg-green-500/10 px-4 py-2 rounded-full`}>
                  <View style={tw`w-2.5 h-2.5 rounded-full bg-green-500 mr-2`} />
                  <Text style={tw`text-green-400 text-sm font-medium`}>Live — Mirroring to Desktop</Text>
                </View>
              )}
              
              <TouchableOpacity 
                style={tw`px-8 py-4 rounded-xl flex-row items-center w-full justify-center ${isSharing ? 'bg-red-500' : 'bg-primary'}`}
                onPress={isSharing ? stopSharing : startSharing}>
                {isSharing ? (
                  <X color="#fff" size={20} style={tw`mr-2`} />
                ) : (
                  <Camera color={tw.color('on-primary')} size={20} style={tw`mr-2`} />
                )}
                <Text style={tw`text-white font-bold text-base`}>
                  {isSharing ? "Stop Mirroring" : "Start Mirroring"}
                </Text>
              </TouchableOpacity>

              {status === 'error' && (
                <View style={tw`flex-row items-center mt-3`}>
                  <AlertTriangle color={tw.color('red-400')} size={16} style={tw`mr-2`} />
                  <Text style={tw`text-red-400 text-sm`}>Failed to start screen mirror</Text>
                </View>
              )}
            </View>
          )}

          {/* Not connected warning */}
          {!isConnected && adbStatus !== null && (
            <View style={tw`bg-yellow-500/10 p-4 rounded-xl flex-row items-start`}>
              <AlertTriangle color={tw.color('yellow-400')} size={18} style={tw`mr-3 mt-0.5`} />
              <View style={tw`flex-1`}>
                <Text style={tw`text-yellow-400 text-sm font-medium mb-1`}>USB Connection Required</Text>
                <Text style={tw`text-yellow-400/70 text-xs`}>
                  Follow the setup steps above, then connect your phone via USB cable. The status will update automatically.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function DashboardScreen() {
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
  }, [apiBase]);

  const formatUptime = (seconds) => {
    if (!seconds) return '0s';
    const d = Math.floor(seconds / (3600*24));
    const h = Math.floor(seconds % (3600*24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const s = Math.floor(seconds % 60);
    return `${d}d ${h}h ${m}m ${s}s`;
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-surface-dim`}>
      <ScrollView contentContainerStyle={tw`p-6 pt-10`}>
        <View style={tw`flex-row items-center justify-between mb-2`}>
            <View>
              <Text style={tw`text-3xl font-bold text-on-surface`}>System<Text style={tw`text-primary`}>Dash</Text></Text>
              <View style={tw`flex-row items-center mt-1`}>
                <View style={tw`w-2.5 h-2.5 rounded-full mr-2 ${status === 'live' ? 'bg-green-500' : status === 'checking' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                <Text style={tw`text-white font-medium text-sm`}>
                  {status === 'live' ? 'Online & Live' : status === 'checking' ? 'Connecting...' : 'Offline / Down'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => { setTempApi(apiBase); setEditApi(true); }} style={tw`bg-surface-container rounded-full p-3`}>
                <Activity color={tw.color('on-surface')} size={20} />
            </TouchableOpacity>
        </View>
        <Text style={tw`text-outline mb-6 font-mono text-sm mt-2`}>
          Active Uptime: {metrics ? formatUptime(metrics.uptime) : 'Waiting...'}
        </Text>

        <Modal visible={editApi} transparent={true} animationType="fade">
          <View style={tw`flex-1 justify-center items-center bg-black/80 px-6`}>
            <View style={tw`bg-surface-container w-full p-6 rounded-lg`}>
              <Text style={tw`text-on-surface font-bold text-lg mb-4`}>Server API URL</Text>
              <TextInput
                style={tw`bg-surface-dim p-4 text-on-surface font-mono rounded-md mb-4`}
                value={tempApi}
                onChangeText={setTempApi}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={tw`flex-row justify-end gap-3`}>
                <TouchableOpacity onPress={() => setEditApi(false)} style={tw`px-4 py-2`}>
                  <Text style={tw`text-on-surface`}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setApiBase(tempApi); setEditApi(false); }} style={tw`bg-primary px-4 py-2 rounded-md`}>
                  <Text style={tw`text-on-primary font-bold`}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        
        <View style={tw`flex-row gap-3 mb-8`}>
          <TouchableOpacity style={tw`bg-surface-container px-4 py-2 rounded-md`}>
            <Text style={tw`text-on-surface text-xs font-bold tracking-widest`}>GENERATE REPORT</Text>
          </TouchableOpacity>
        </View>

        {/* Custom Core Card */}
        <View style={tw`bg-surface-container-low p-6 rounded-md mb-6`}>
          <View style={tw`flex-row items-center justify-between mb-4`}>
            <Text style={tw`text-on-surface text-xs font-bold tracking-widest`}>CPU UTILIZATION</Text>
            <Activity color={tw.color('outline')} size={16} />
          </View>
          <Text style={tw`text-4xl text-on-surface font-bold tracking-wider`}>
            {metrics ? metrics.cpu_usage.toFixed(1) : '--'}<Text style={tw`text-lg text-outline`}>%</Text>
          </Text>
        </View>

        <View style={tw`bg-surface-container-low p-6 rounded-md mb-6`}>
          <View style={tw`flex-row items-center justify-between mb-4`}>
            <Text style={tw`text-secondary text-xs font-bold tracking-widest`}>MEMORY ALLOCATION</Text>
          </View>
          <Text style={tw`text-4xl text-on-surface font-bold tracking-wider`}>
            {metrics ? (metrics.ram_usage.used / 1e9).toFixed(1) : '--'} <Text style={tw`text-lg text-outline`}>GB</Text>
          </Text>
          {metrics && (
              <Text style={tw`text-outline text-xs mt-2`}>Total: {(metrics.ram_usage.total / 1e9).toFixed(1)} GB ({metrics.ram_usage.percent}% Used)</Text>
          )}
        </View>
        
        <View style={tw`bg-surface-container-low p-6 rounded-md mb-6`}>
          <View style={tw`flex-row items-center justify-between mb-4`}>
            <Text style={tw`text-secondary text-xs font-bold tracking-widest`}>STORAGE</Text>
          </View>
          <Text style={tw`text-4xl text-on-surface font-bold tracking-wider`}>
            {metrics ? (metrics.disk_usage.used / 1e9).toFixed(1) : '--'} <Text style={tw`text-lg text-outline`}>GB</Text>
          </Text>
          {metrics && (
              <Text style={tw`text-outline text-xs mt-2`}>Total: {(metrics.disk_usage.total / 1e9).toFixed(1)} GB ({metrics.disk_usage.percent}% Used)</Text>
          )}
        </View>

        <View style={tw`bg-surface-container-low p-6 rounded-md mb-6`}>
          <Text style={tw`text-secondary text-xs font-bold tracking-widest mb-4`}>CLIPBOARD SYNC</Text>
          <View style={tw`flex-row gap-3`}>
            <TouchableOpacity onPress={async () => {
              try {
                const { data } = await axios.get(`${apiBase}/clipboard`);
                if (data.type === 'image' && data.content) {
                  await Clipboard.setImageAsync(data.content);
                  Alert.alert("Success", "Image copied from PC to Phone");
                } else if(data.content && data.content.trim() !== "") {
                  await Clipboard.setStringAsync(data.content);
                  Alert.alert("Success", "Text copied from PC to Phone");
                } else {
                  Alert.alert("Info", data.error || "PC Clipboard is empty");
                }
              } catch(e) { Alert.alert("Error", "Could not fetch PC clipboard"); }
            }} style={tw`flex-1 bg-primary text-center py-3 rounded-md`}>
              <View style={tw`flex-row justify-center items-center`}><Download color={tw.color('on-primary')} size={18} style={tw`mr-2`} /><Text style={tw`text-on-primary font-bold`}>Fetch PC</Text></View>
            </TouchableOpacity>

            <TouchableOpacity onPress={async () => {
              try {
                if (await Clipboard.hasImageAsync()) {
                  const clipImage = await Clipboard.getImageAsync({ format: 'png' });
                  if (clipImage && clipImage.data) {
                    await axios.post(`${apiBase}/clipboard`, { type: 'image', content: clipImage.data });
                    Alert.alert("Success", "Image sent to PC Clipboard");
                    return;
                  }
                }
                const text = await Clipboard.getStringAsync();
                if(text && text.trim() !== "") {
                  await axios.post(`${apiBase}/clipboard`, { type: 'text', content: text });
                  Alert.alert("Success", "Text sent to PC Clipboard");
                } else {
                  Alert.alert("Info", "Phone clipboard is empty");
                }
              } catch(e) { Alert.alert("Error", "Could not send to PC"); }
            }} style={tw`flex-1 bg-surface-container py-3 rounded-md`}>
              <View style={tw`flex-row justify-center items-center`}><Upload color={tw.color('on-surface')} size={18} style={tw`mr-2`} /><Text style={tw`text-on-surface font-bold`}>Send to PC</Text></View>
            </TouchableOpacity>
          </View>
          
          <Text style={tw`text-outline text-xs mt-6 mb-2`}>Manual Paste / Send Image</Text>
          <View style={tw`flex-row gap-3 items-center`}>
            <TextInput 
              style={tw`flex-1 bg-surface-dim px-4 py-3 rounded-md text-on-surface font-mono`}
              placeholder="Paste text here to manually send..."
              placeholderTextColor={tw.color('outline')}
              onChangeText={async (text) => {
                if(text && text.trim() !== "") {
                   try {
                     await axios.post(`${apiBase}/clipboard`, { type: 'text', content: text });
                   } catch(e) {}
                }
              }}
            />
            <TouchableOpacity onPress={async () => {
              try {
                const res = await DocumentPicker.getDocumentAsync({ type: 'image/*' });
                if (!res.canceled && res.assets && res.assets.length > 0) {
                  const asset = res.assets[0];
                  const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
                  await axios.post(`${apiBase}/clipboard`, { type: 'image', content: base64 });
                  Alert.alert("Success", "Selected image sent to PC Clipboard");
                }
              } catch(e) { Alert.alert("Error", "Could not pick/send image: " + e.message); }
            }} style={tw`bg-surface-container p-3 rounded-md`}>
              <Camera color={tw.color('on-surface')} size={24} />
            </TouchableOpacity>
          </View>
        </View>

        {/* POWER SYSTEM MATRIX */}
        <View style={tw`bg-surface-container-low p-6 rounded-md mb-6 border border-red-500/20`}>
          <View style={tw`flex-row items-center mb-4`}>
             <Zap color={tw.color('red-400')} size={20} style={tw`mr-2`} />
             <Text style={tw`text-red-400 text-xs font-bold tracking-widest`}>GOD MODE POWER SYSTEM</Text>
          </View>
          <Text style={tw`text-outline text-xs mb-4 leading-5`}>
            Unlock Android's highest persistence privileges to completely bypass background killing on TECNO/HiOS and other strict OEM systems.
          </Text>

          <TouchableOpacity onPress={() => NativeModules.BackgroundService.openAutoStartSettings()} style={tw`bg-surface-container py-3 px-4 rounded-md mb-2 flex-row justify-between items-center`}>
            <View>
              <Text style={tw`text-on-surface font-bold text-sm`}>1. Enable OEM Auto-Start</Text>
              <Text style={tw`text-outline text-xs mt-0.5`}>Allow app to boot automatically in background</Text>
            </View>
            <Activity color={tw.color('primary')} size={18} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => NativeModules.BackgroundService.requestBatteryOptimizationExemption()} style={tw`bg-surface-container py-3 px-4 rounded-md mb-2 flex-row justify-between items-center`}>
            <View>
              <Text style={tw`text-on-surface font-bold text-sm`}>2. Bypass Battery Limits</Text>
              <Text style={tw`text-outline text-xs mt-0.5`}>Set power restriction to 'Unrestricted'</Text>
            </View>
            <Zap color={tw.color('yellow-400')} size={18} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => NativeModules.BackgroundService.openNotificationListenerSettings()} style={tw`bg-surface-container py-3 px-4 rounded-md mb-2 flex-row justify-between items-center`}>
            <View>
              <Text style={tw`text-on-surface font-bold text-sm`}>3. Notification Listener</Text>
              <Text style={tw`text-outline text-xs mt-0.5`}>System auto-restart on force close</Text>
            </View>
            <RefreshCcw color={tw.color('blue-400')} size={18} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => NativeModules.BackgroundService.openAccessibilitySettings()} style={tw`bg-surface-container py-3 px-4 rounded-md mb-2 flex-row justify-between items-center`}>
            <View>
              <Text style={tw`text-red-400 font-bold text-sm`}>4. Root Access: Accessibility</Text>
              <Text style={tw`text-red-400/70 text-xs mt-0.5`}>Absolute Immortality (Impossible to kill)</Text>
            </View>
            <Shield color={tw.color('red-400')} size={18} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => NativeModules.BackgroundService.openDeviceAdminSettings()} style={tw`bg-surface-container py-3 px-4 rounded-md flex-row justify-between items-center`}>
            <View>
              <Text style={tw`text-purple-400 font-bold text-sm`}>5. Enterprise: Device Admin</Text>
              <Text style={tw`text-purple-400/70 text-xs mt-0.5`}>Prevent uninstalls and memory wipes</Text>
            </View>
            <Lock color={tw.color('purple-400')} size={18} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InputControlScreen({ navigation }) {
  const { apiBase } = useContext(ApiContext);
  const [mode, setMode] = useState('touchpad'); // touchpad or keyboard
  const [sensitivity, setSensitivity] = useState(15);
  const sensRef = useRef(15); 
  const wsRef = useRef(null);
  
  // Trackpad specific
  const lastTapRef = useRef(0);
  const dragRef = useRef(false);

  // Keyboard modifiers
  const [activeMods, setActiveMods] = useState({});

  const updateSensitivity = (val) => {
     let newSens = Math.max(1, Math.min(50, val));
     setSensitivity(newSens);
     sensRef.current = newSens;
  };

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ tabBarStyle: { display: 'none' } });
      navigation.setOptions({ tabBarStyle: { display: 'none' } });
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      StatusBar.setHidden(true);
      
      const host = apiBase.replace('http:', 'ws:').replace('https:', 'wss:').replace('/api/system', '');
      const wsUrl = host + '/api/input/ws/input/remote';
      wsRef.current = new WebSocket(wsUrl);
      
      return () => {
        if (wsRef.current) wsRef.current.close();
        navigation.getParent()?.setOptions({ tabBarStyle: tw`bg-surface-dim border-t-0 shadow-none pt-2 pb-5 h-20` });
        navigation.setOptions({ tabBarStyle: tw`bg-surface-dim border-t-0 shadow-none pt-2 pb-5 h-20` });
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
        StatusBar.setHidden(false);
      };
    }, [navigation, apiBase])
  );

  const keyEvent = (type, key) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: type, key }));
    }
  };

  const handleKey = (code) => {
      const isMod = ['shift', 'ctrl', 'alt', 'win'].includes(code);
      if (isMod) {
          setActiveMods(prev => {
              const isActive = !prev[code];
              const next = {...prev, [code]: isActive};
              keyEvent(isActive ? 'key_down' : 'key_up', code);
              return next;
          });
      } else {
          keyEvent('key_press', code);
          // Auto release modifiers after standard key is pressed
          if (Object.keys(activeMods).some(m => activeMods[m])) {
              Object.keys(activeMods).forEach(mod => {
                 if (activeMods[mod]) keyEvent('key_up', mod);
              });
              setActiveMods({});
          }
      }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        if (evt.nativeEvent.touches.length === 2 && wsRef.current?.readyState === WebSocket.OPEN) {
           wsRef.current.send(JSON.stringify({ type: 'mouse_click', button: 'right' }));
        } else if (evt.nativeEvent.touches.length === 1) {
           const now = Date.now();
           if (now - lastTapRef.current < 250) {
              dragRef.current = true;
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({ type: 'mouse_down', button: 'left' }));
              }
           }
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          if (evt.nativeEvent.touches.length === 1) {
             const dx = gestureState.vx * sensRef.current;
             const dy = gestureState.vy * sensRef.current;
             if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
                 wsRef.current.send(JSON.stringify({ type: 'mouse_move', dx: dx, dy: dy }));
             }
          } else if (evt.nativeEvent.touches.length === 2) {
             wsRef.current.send(JSON.stringify({ type: 'mouse_scroll', sx: 0, sy: gestureState.vy > 0 ? -1 : 1 }));
          }
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (dragRef.current) {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'mouse_up', button: 'left' }));
            }
            dragRef.current = false;
        } else if (Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5 && evt.nativeEvent.touches.length < 2) {
           if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'mouse_click', button: 'left' }));
           }
        }
        lastTapRef.current = Date.now();
      },
    })
  ).current;

  const KeyBtn = ({ title, code, flex = 1 }) => {
    const isMod = ['shift', 'ctrl', 'alt', 'win'].includes(code);
    const isActive = isMod && activeMods[code];
    return (
      <TouchableOpacity 
        activeOpacity={0.5}
        style={[{ flex: flex }, tw`p-2 rounded mx-0.5 mb-1 items-center justify-center border border-outline/20`, isActive ? tw`bg-primary` : tw`bg-surface-container`]}
        onPress={() => handleKey(code || title.toLowerCase())}>
        <Text style={tw`font-mono text-xs font-bold ${isActive ? 'text-white' : 'text-on-surface'}`}>{title}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={tw`flex-1 bg-black`}>
      <View style={tw`absolute top-2 left-4 z-50 flex-row bg-surface-container rounded-full p-1 opacity-60`}>
         <TouchableOpacity style={tw`px-4 py-2 ${mode === 'touchpad' ? 'bg-primary rounded-full' : ''}`} onPress={() => setMode('touchpad')}>
            <Text style={tw`${mode === 'touchpad' ? 'text-white font-bold' : 'text-outline'} text-xs`}>TOUCHPAD</Text>
         </TouchableOpacity>
         <TouchableOpacity style={tw`px-4 py-2 ${mode === 'keyboard' ? 'bg-primary rounded-full' : ''}`} onPress={() => setMode('keyboard')}>
            <Text style={tw`${mode === 'keyboard' ? 'text-white font-bold' : 'text-outline'} text-xs`}>KEYBOARD</Text>
         </TouchableOpacity>
         <TouchableOpacity style={tw`px-4 py-2`} onPress={() => navigation.goBack()}>
            <Text style={tw`text-red-400 text-xs`}>EXIT</Text>
         </TouchableOpacity>
      </View>

      {mode === 'touchpad' ? (
        <View style={tw`flex-1 bg-[#111]`} {...panResponder.panHandlers}>
            <View style={tw`absolute top-2 right-4 z-50 flex-row items-center bg-surface-container rounded-full p-2 opacity-60`}>
                <Text style={tw`text-outline text-xs mr-2`}>SPEED: {sensitivity}</Text>
                <TouchableOpacity onPress={() => updateSensitivity(sensitivity - 2)} style={tw`bg-surface-dim px-3 py-1 mr-1 rounded`}>
                   <Text style={tw`text-white font-bold`}>-</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => updateSensitivity(sensitivity + 2)} style={tw`bg-surface-dim px-3 py-1 rounded`}>
                   <Text style={tw`text-white font-bold`}>+</Text>
                </TouchableOpacity>
            </View>

            <View style={tw`absolute inset-0 items-center justify-center pointer-events-none`}>
              <Mouse color="#333" size={64} />
              <Text style={tw`text-[#333] mt-2 font-mono text-center`}>Virtual Trackpad{'\n'}<Text style={tw`text-xs text-[#555]`}>Double-tap and hold to drag/select</Text></Text>
            </View>
        </View>
      ) : (
        <View style={tw`flex-1 bg-surface-dim pt-12 px-2 pb-2 justify-center`}>
           <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`pb-4`}>
             <View style={tw`flex-row mb-1`}>
                <KeyBtn title="ESC" code="escape" flex={1.5} />
                {Array.from({length: 12}).map((_, i) => <KeyBtn key={i} title={`F${i+1}`} code={`f${i+1}`} />)}
                <KeyBtn title="DEL" code="delete" flex={1.5} />
             </View>
             <View style={tw`flex-row mb-1`}>
                <KeyBtn title="`" code="`" />
                {['1','2','3','4','5','6','7','8','9','0','-','='].map(k => <KeyBtn key={k} title={k} />)}
                <KeyBtn title="BACKSPACE" code="backspace" flex={2} />
             </View>
             <View style={tw`flex-row mb-1`}>
                <KeyBtn title="TAB" code="tab" flex={1.5} />
                {['Q','W','E','R','T','Y','U','I','O','P','[',']','\\'].map(k => <KeyBtn key={k} title={k} code={k.toLowerCase()} />)}
             </View>
             <View style={tw`flex-row mb-1 ml-4`}>
                {['A','S','D','F','G','H','J','K','L',';',"'"].map(k => <KeyBtn key={k} title={k} code={k.toLowerCase()} />)}
                <KeyBtn title="ENTER" code="enter" flex={2} />
             </View>
             <View style={tw`flex-row mb-1`}>
                <KeyBtn title="SHIFT" code="shift" flex={2.5} />
                {['Z','X','C','V','B','N','M',',','.','/'].map(k => <KeyBtn key={k} title={k} code={k.toLowerCase()} />)}
                <KeyBtn title="SHIFT" code="shift" flex={2.5} />
             </View>
             <View style={tw`flex-row mb-1`}>
                <KeyBtn title="CTRL" code="ctrl" flex={1.5} />
                <KeyBtn title="WIN" code="win" flex={1.5} />
                <KeyBtn title="ALT" code="alt" flex={1.5} />
                <KeyBtn title="SPACE" code="space" flex={8} />
                <KeyBtn title="ALT" code="alt" flex={1.5} />
                <KeyBtn title="CTRL" code="ctrl" flex={1.5} />
                <KeyBtn title="◀" code="left" flex={1} />
                <View style={tw`flex-col flex-1 mx-0.5 justify-between`}>
                    <KeyBtn title="▲" code="up" flex={1} />
                    <KeyBtn title="▼" code="down" flex={1} />
                </View>
                <KeyBtn title="▶" code="right" flex={1} />
             </View>
           </ScrollView>
        </View>
      )}
    </View>
  );
}

function SystemScreen({ navigation }) {
  const { apiBase } = useContext(ApiContext);
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    let ws;
    let isActive = true;
    const connect = () => {
      if (!isActive) return;
      const wsUrl = apiBase.replace('http:', 'ws:').replace('https:', 'wss:') + '/ws/metrics';
      ws = new WebSocket(wsUrl);
      ws.onmessage = (e) => {
        if (isActive) setMetrics(JSON.parse(e.data));
      };
      ws.onerror = (e) => console.log('WS Error');
      ws.onclose = () => { if (isActive) setTimeout(connect, 3000); };
    };
    connect();
    return () => { isActive = false; if (ws) ws.close(); };
  }, []);

  if (!metrics) {
    return (
      <View style={tw`flex-1 bg-surface-dim justify-center items-center`}>
         <ActivityIndicator size="large" color={tw.color('primary')} />
         <Text style={tw`text-primary mt-4 font-mono`}>Connecting to Engine...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={tw`flex-1 bg-surface-dim`}>
      <ScrollView contentContainerStyle={tw`p-6 pt-10`}>
        <Text style={tw`text-2xl font-bold text-on-surface mb-6`}>Kernel Performance</Text>
        <View style={tw`bg-surface-container-low p-5 rounded-md mb-4`}>
          <Text style={tw`text-outline text-xs tracking-widest mb-1`}>PROCESSOR LOAD</Text>
          <Text style={tw`text-3xl font-bold text-on-surface`}>{metrics.cpu_usage}%</Text>
        </View>
        <View style={tw`bg-surface-container-low p-5 rounded-md mb-4`}>
          <Text style={tw`text-outline text-xs tracking-widest mb-1`}>MEMORY USAGE</Text>
          <Text style={tw`text-3xl font-bold text-on-surface`}>{metrics.ram_usage.percent}%</Text>
          <Text style={tw`text-outline mt-1 font-mono text-xs`}>{Math.round(metrics.ram_usage.used / 1e9)}GB / {Math.round(metrics.ram_usage.total / 1e9)}GB</Text>
        </View>
        <View style={tw`bg-surface-container-low p-5 rounded-md mb-4`}>
          <Text style={tw`text-outline text-xs tracking-widest mb-1`}>DATA THROUGHPUT (DISK)</Text>
          <Text style={tw`text-3xl font-bold text-on-surface`}>{metrics.disk_usage.percent}%</Text>
          <Text style={tw`text-outline mt-1 font-mono text-xs`}>{Math.round(metrics.disk_usage.used / 1e9)}GB USED</Text>
        </View>

        <Text style={tw`text-xl font-bold text-on-surface mt-6 mb-4`}>System Tools</Text>
        
        <TouchableOpacity onPress={() => navigation.navigate('Phone Share')} style={tw`bg-surface-container py-4 px-5 rounded-xl mb-4 flex-row items-center border border-white/5`}>
           <View style={tw`w-12 h-12 rounded-full bg-primary/20 items-center justify-center mr-4`}>
              <Smartphone color={tw.color('primary')} size={24} />
           </View>
           <View style={tw`flex-1`}>
             <Text style={tw`text-on-surface font-bold text-base`}>Phone Share</Text>
             <Text style={tw`text-outline text-xs mt-1`}>Mirror phone screen to desktop via USB</Text>
           </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('InputPad')} style={tw`bg-surface-container py-4 px-5 rounded-xl mb-8 flex-row items-center border border-white/5`}>
           <View style={tw`w-12 h-12 rounded-full bg-primary/20 items-center justify-center mr-4`}>
              <Mouse color={tw.color('primary')} size={24} />
           </View>
           <View style={tw`flex-1`}>
             <Text style={tw`text-on-surface font-bold text-base`}>Virtual Input</Text>
             <Text style={tw`text-outline text-xs mt-1`}>Trackpad and keyboard control</Text>
           </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function TerminalScreen() {
  const { apiBase } = useContext(ApiContext);
  const [cmd, setCmd] = useState('');
  const [history, setHistory] = useState([]);

  const executeCmd = async () => {
    if (!cmd.trim()) return;
    try {
      const res = await axios.post(`${apiBase}/terminal?command=${encodeURIComponent(cmd)}`);
      setHistory(h => [...h, { cmd, out: res.data.stdout || res.data.error || res.data.stderr }]);
      setCmd('');
    } catch (e) {
      setHistory(h => [...h, { cmd, out: "Process failed or access denied." }]);
      setCmd('');
    }
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-surface-dim`}>
      <View style={tw`bg-surface-container-low px-6 py-4 flex-row items-center border-b border-surface-container-highest`}>
        <Text style={tw`text-on-surface font-bold text-lg tracking-wider`}>TERMINAL_CONSOLE</Text>
      </View>
      
      <ScrollView style={tw`flex-1 px-4 py-6 bg-black`} contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Boot message */}
        <Text style={tw`text-secondary font-mono mb-2`}>CORE-OS(tm) Kernel 6.2.0-31-generic (x86_64)</Text>
        <Text style={tw`text-outline font-mono mb-6`}>Last login: {new Date().toLocaleString()} from 127.0.0.1</Text>
        
        {history.map((h, i) => (
          <View key={i} style={tw`mb-4`}>
            <View style={tw`flex-row flex-wrap`}>
              <Text style={tw`text-primary font-mono`}>root@the-core</Text>
              <Text style={tw`text-on-surface font-mono`}> : ~ $ {h.cmd}</Text>
            </View>
            <Text style={tw`text-outline font-mono mt-1`}>{h.out}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={tw`p-4 bg-surface-container-low flex-row items-center`}>
        <Text style={tw`text-secondary font-mono mr-3`}>$</Text>
        <TextInput
          style={tw`flex-1 text-on-surface font-mono text-base py-2`}
          placeholder="Enter system command..."
          placeholderTextColor={tw.color('outline')}
          value={cmd}
          onChangeText={setCmd}
          onSubmitEditing={executeCmd}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity onPress={executeCmd}>
          <TerminalIcon color={tw.color('outline')} size={24} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function FilesScreen() {
  const { apiBase } = useContext(ApiContext);
  const [currentPath, setCurrentPath] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // File viewer state
  const [viewFile, setViewFile] = useState(null);
  const [fileType, setFileType] = useState('text'); // text, image, pdf, etc
  const [fileContent, setFileContent] = useState('');
  const [savingFile, setSavingFile] = useState(false);
  const [renameItem, setRenameItem] = useState(null);
  const [newName, setNewName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchFiles = async (path = null) => {
    setLoading(true);
    try {
      const url = path ? `${apiBase}/files?path=${encodeURIComponent(path)}` : `${apiBase}/files`;
      const { data } = await axios.get(url);
      setCurrentPath(data.current_dir);
      setFiles(data.items);
    } catch (e) {
      console.error("Error fetching files:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handlePress = async (item) => {
    if (item.is_dir) {
      fetchFiles(item.path);
    } else {
      const name = item.name.toLowerCase();
      const textExtensions = ['.txt', '.js', '.jsx', '.ts', '.tsx', '.json', '.py', '.md', '.html', '.css', '.yml', '.yaml', '.csv', '.log', '.env', '.sh', '.xml', '.java', '.yam', '.c', '.cpp', '.h', '.hpp', '.cs', '.php', '.rb', '.go', '.rs', '.kt', '.swift', '.ini', '.cfg', '.conf', '.bat', '.ps1', '.sql'];
      const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
      
      let type = 'other';
      if (textExtensions.some(ext => name.endsWith(ext))) {
        type = 'text';
      } else if (imageExtensions.some(ext => name.endsWith(ext))) {
        type = 'image';
      }

      setFileType(type);
      setViewFile(item);

      if (type === 'text') {
        try {
          setLoading(true);
          const { data } = await axios.get(`${apiBase}/file/read?path=${encodeURIComponent(item.path)}`);
          setFileContent(data.content);
        } catch (e) {
          Alert.alert("Error", "Could not open text file.");
          setViewFile(null);
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const handleSaveFile = async () => {
    try {
      setSavingFile(true);
      await axios.post(`${apiBase}/file/write`, {
        path: viewFile.path,
        content: fileContent
      });
      Alert.alert("Success", "File saved");
    } catch(e) {
      Alert.alert("Error", "Failed to save file.");
    } finally {
      setSavingFile(false);
    }
  };

  
  const handleRename = async () => {
    if (!newName || !renameItem || newName === renameItem.name) {
      setRenameItem(null);
      return;
    }
    try {
      const parent = currentPath;
      const newPath = parent + '/' + newName;
      await axios.post(`${apiBase}/file/rename`, {
        old_path: renameItem.path,
        new_path: newPath
      });
      setRenameItem(null);
      fetchFiles(currentPath);
    } catch(e) {
      Alert.alert("Error", "Failed to rename item.");
    }
  };

  const handleDownload = async (item) => {
    try {
      setLoading(true);
      const safeName = item.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const downloadUrl = `${apiBase}/file/download?path=${encodeURIComponent(item.path)}`;
      const fileUri = FileSystem.documentDirectory + safeName;
      
      const { uri } = await FileSystem.downloadAsync(downloadUrl, fileUri);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { dialogTitle: 'Save or Share File' });
      } else {
        Alert.alert("Success", "File downloaded successfully, but sharing is not available.");
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Error", `Could not download file: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLongPress = (item) => {
    Alert.alert(
      "File Options",
      `${item.name}`,
      [
        { text: "Download", onPress: () => handleDownload(item) },
        { text: "Rename", onPress: () => { setRenameItem(item); setNewName(item.name); } },
        { text: "Delete", style: "destructive", onPress: () => confirmDelete(item) },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const confirmDelete = (item) => {
    Alert.alert("Confirm", `Are you sure you want to delete ${item.name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          try {
            await axios.delete(`${apiBase}/file/delete?path=${encodeURIComponent(item.path)}`);
            fetchFiles(currentPath);
          } catch(e) {
            Alert.alert("Error", "Failed to delete item.");
          }
      }}
    ]);
  };

  const handleUp = () => {
    if (currentPath) {
      const parent = currentPath.substring(0, currentPath.lastIndexOf('/'));
      fetchFiles(parent || '/');
    }
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-surface-dim`}>
      <ScrollView contentContainerStyle={tw`p-6 pt-10`}>
        <View style={tw`flex-row items-center mb-4 gap-3`}>
          <TouchableOpacity onPress={handleUp} style={tw`bg-surface-container p-3 rounded-md`}>
            <View style={tw`flex-row items-center`}><ArrowUp color={tw.color('on-surface')} size={16} /><Text style={tw`text-on-surface font-bold text-xs ml-1`}>UP</Text></View>
          </TouchableOpacity>
          <View style={tw`flex-1 bg-surface-container px-4 py-3 rounded-md`}>
            <Text style={tw`text-on-surface tracking-wider font-mono text-xs`} numberOfLines={1}>{currentPath || 'Loading...'}</Text>
          </View>
          <TouchableOpacity onPress={async () => {
              if(!currentPath) return;
              try {
                const res = await DocumentPicker.getDocumentAsync();
                if (!res.canceled && res.assets && res.assets.length > 0) {
                  Alert.alert("Uploading", "Sending file to PC...");
                  const file = res.assets[0];
                  let formData = new FormData();
                  formData.append("file", { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' });
                  await axios.post(`${apiBase}/file/upload?path=${encodeURIComponent(currentPath)}`, formData, { headers: { "Content-Type": 'multipart/form-data' }});
                  Alert.alert("Success", "File uploaded to PC!");
                  fetchFiles(currentPath);
                }
              } catch(e) { Alert.alert("Error", "Upload failed"); }
          }} style={tw`bg-primary p-3 rounded-md`}>
             <View style={tw`flex-row items-center`}><UploadCloud color={tw.color('on-primary')} size={16} style={tw`mr-1`} /><Text style={tw`text-on-primary font-bold text-xs`}>Upload</Text></View>
          </TouchableOpacity>
        </View>

        <TextInput
          style={tw`bg-surface-container p-4 text-on-surface font-mono rounded-md mb-8`}
          placeholder="Search files..."
          placeholderTextColor={tw.color('outline')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={tw`text-outline text-xs tracking-widest mb-4`}>DIRECTORY CONTENTS (Long press options)</Text>
        
        {loading && !viewFile ? (
          <ActivityIndicator color={tw.color('primary')} size="large" style={tw`mt-10`} />
        ) : (
          files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())).map((item, idx) => (
            <TouchableOpacity 
              key={idx} 
              onPress={() => handlePress(item)} 
              onLongPress={() => handleLongPress(item)}
              style={tw`bg-surface-container-low p-4 rounded-md mb-3 flex-row items-center`}
            >
              <Folder color={item.is_dir ? tw.color('primary') : tw.color('outline')} size={24} style={tw`mr-4`} />
              <View style={tw`flex-1`}>
                <Text style={tw`text-on-surface font-bold text-base`} numberOfLines={1}>{item.name}</Text>
                <Text style={tw`text-outline text-xs font-mono mt-1`}>
                  {item.is_dir ? 'DIR' : `${(item.size / 1024).toFixed(1)} KB`}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      
      {/* Rename Modal */}
      <Modal visible={!!renameItem} transparent={true} animationType="fade">
        <View style={tw`flex-1 justify-center items-center bg-black/80 px-6`}>
          <View style={tw`bg-surface-container w-full p-6 rounded-lg`}>
            <Text style={tw`text-on-surface font-bold text-lg mb-4`}>Rename</Text>
            <TextInput
              style={tw`bg-surface-dim p-4 text-on-surface font-mono rounded-md mb-4`}
              value={newName}
              onChangeText={setNewName}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={tw`flex-row justify-end gap-3`}>
              <TouchableOpacity onPress={() => setRenameItem(null)} style={tw`px-4 py-2`}>
                <Text style={tw`text-on-surface`}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleRename} style={tw`bg-primary px-4 py-2 rounded-md`}>
                <Text style={tw`text-on-primary font-bold`}>Rename</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!viewFile} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={tw`flex-1 bg-surface-dim`}>
          <View style={tw`flex-row justify-between items-center p-4 bg-surface-container-low`}>
            <Text style={tw`text-on-surface font-bold flex-1 mr-4`} numberOfLines={1}>
              {viewFile ? viewFile.name : ''} {loading && ' (Loading...)'}
            </Text>
            <View style={tw`flex-row gap-2`}>
              {fileType === 'text' && (
                <TouchableOpacity onPress={handleSaveFile} style={tw`bg-primary px-4 py-2 rounded-md`}>
                  <Text style={tw`text-on-primary font-bold`}>{savingFile ? 'Saving...' : 'Save'}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => { setViewFile(null); setFileContent(''); setFileType('text') }} style={tw`bg-surface-container-highest px-4 py-2 rounded-md`}>
                <Text style={tw`text-on-surface font-bold`}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {fileType === 'text' && (
            <TextInput
              style={tw`flex-1 p-4 text-on-surface font-mono text-xs bg-black`}
              multiline
              textAlignVertical="top"
              value={fileContent}
              onChangeText={setFileContent}
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}

          {fileType === 'image' && viewFile && (
            <View style={tw`flex-1 bg-black justify-center items-center`}>
                <Image 
                    source={{ uri: `${apiBase}/file/download?path=${encodeURIComponent(viewFile.path)}` }} 
                    style={tw`w-full h-full`} 
                    resizeMode="contain" 
                />
            </View>
          )}

          {fileType === 'other' && viewFile && (
            <WebView 
              source={{ uri: `${apiBase}/file/download?path=${encodeURIComponent(viewFile.path)}` }} 
              style={tw`flex-1`} 
            />
          )}

        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}


function RemoteScreen({ navigation }) {
  const { apiBase } = useContext(ApiContext);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ tabBarStyle: { display: 'none' } });
      navigation.setOptions({ tabBarStyle: { display: 'none' } });
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      StatusBar.setHidden(true);
      return () => {
        navigation.getParent()?.setOptions({ tabBarStyle: tw`bg-surface-dim border-t-0 shadow-none pt-2 pb-5 h-20` });
        navigation.setOptions({ tabBarStyle: tw`bg-surface-dim border-t-0 shadow-none pt-2 pb-5 h-20` });
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
        StatusBar.setHidden(false);
      };
    }, [navigation])
  );

  const wsUrl = apiBase.replace('http:', 'ws:').replace('https:', 'wss:') + '/ws/screen';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
      <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: auto; display: flex; justify-content: center; align-items: center; overscroll-behavior: none; }
        img { max-width: 100%; max-height: 100%; object-fit: contain; transform-origin: center; touch-action: pan-x pan-y pinch-zoom; }
        #fab-container { position: fixed; bottom: 15px; right: 15px; z-index: 100; display: flex; flex-direction: row; gap: 8px; align-items: center; transition: all 0.3s ease; }
        .fab-btn { font-size: 12px; font-family: monospace; font-weight: bold; background: rgba(0,0,0,0.4); color: white; border: 1px solid rgba(255,255,255,0.5); border-radius: 20px; width: 40px; height: 40px; display: flex; justify-content: center; align-items: center; cursor: pointer; user-select: none; }
        .fab-btn.active { background: rgba(255,255,255,0.9); color: black; }
        #kbd-btn svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
        #fab-toggle { background: rgba(0,0,0,0.6); padding: 8px; border-radius: 20px; cursor: pointer; user-select:none; display: flex; align-items: center; color: white; border: 1px solid rgba(255,255,255,0.5); }
        #fab-toggle svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
        .hidden-btns .fab-btn:not(#kbd-btn) { display: none; }
        #kbd-input { position: absolute; top: -1000px; left: -1000px; opacity: 0; }
        #fn-bar-container { position: fixed; bottom: 15px; left: 15px; z-index: 100; display: flex; flex-direction: row; gap: 8px; align-items: end; }
        #fn-bar { display: flex; gap: 5px; flex-wrap: nowrap; overflow-x: auto; background: rgba(0,0,0,0.6); padding: 5px 10px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.3); max-width: calc(100vw - 160px); transition: all 0.3s ease; }
        #fn-bar::-webkit-scrollbar { display: none; }
        #fn-bar.hidden { display: none; }
        .fn-btn { font-size: 11px; font-family: monospace; font-weight: bold; background: rgba(50,50,50,0.8); color: white; border: none; border-radius: 5px; padding: 6px 12px; cursor: pointer; user-select: none; flex-shrink: 0; }
        .fn-btn:active { background: white; color: black; }
        #fn-toggle { background: rgba(0,0,0,0.6); padding: 8px 12px; border-radius: 20px; cursor: pointer; user-select:none; display: flex; align-items: center; color: white; border: 1px solid rgba(255,255,255,0.5); font-family: monospace; font-weight: bold; font-size: 12px; }
      </style>
    </head>
    <body>
      <img id="screen" src="" />
      <div id="fab-container" class="hidden-btns">
        <div id="fab-toggle">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        </div>
        <div id="shift-btn" class="fab-btn">SHF</div>
        <div id="ctrl-btn" class="fab-btn">CTL</div>
        <div id="win-btn" class="fab-btn">WIN</div>
        <div id="alt-btn" class="fab-btn">ALT</div>
        <div id="kbd-btn" class="fab-btn">
            <svg viewBox="0 0 24 24"><path d="M4 7h16c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V9c0-1.1.9-2 2-2z"></path><line x1="8" y1="11" x2="8" y2="11.01"></line><line x1="12" y1="11" x2="12" y2="11.01"></line><line x1="16" y1="11" x2="16" y2="11.01"></line><line x1="8" y1="15" x2="8" y2="15.01"></line><line x1="12" y1="15" x2="12" y2="15.01"></line><line x1="16" y1="15" x2="16" y2="15.01"></line></svg>
        </div>
      </div>
      <div id="fn-bar-container">
        <div id="fn-toggle">FN\u25B6</div>
        <div id="fn-bar" class="hidden">
          <div class="fn-btn" onclick="sendSp('esc')">ESC</div>
          <div class="fn-btn" onclick="sendSp('tab')">TAB</div>
          <div class="fn-btn" onclick="sendSp('f1')">F1</div>
          <div class="fn-btn" onclick="sendSp('f2')">F2</div>
          <div class="fn-btn" onclick="sendSp('f3')">F3</div>
          <div class="fn-btn" onclick="sendSp('f4')">F4</div>
          <div class="fn-btn" onclick="sendSp('f5')">F5</div>
          <div class="fn-btn" onclick="sendSp('f6')">F6</div>
          <div class="fn-btn" onclick="sendSp('f7')">F7</div>
          <div class="fn-btn" onclick="sendSp('f8')">F8</div>
          <div class="fn-btn" onclick="sendSp('f9')">F9</div>
          <div class="fn-btn" onclick="sendSp('f10')">F10</div>
          <div class="fn-btn" onclick="sendSp('f11')">F11</div>
          <div class="fn-btn" onclick="sendSp('f12')">F12</div>
          <div class="fn-btn" onclick="sendSp('enter')">ENT</div>
          <div class="fn-btn" onclick="sendSp('down')">DWN</div>
          <div class="fn-btn" onclick="sendSp('up')">UP</div>
          <div class="fn-btn" onclick="sendSp('left')">LFT</div>
          <div class="fn-btn" onclick="sendSp('right')">RGT</div>
          <div class="fn-btn" onclick="sendSp('backspace')">BKS</div>
        </div>
      </div>
      <input type="text" id="kbd-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
      
      <script>
        const img = document.getElementById('screen');
        const kbdBtn = document.getElementById('kbd-btn');
        const kbdInput = document.getElementById('kbd-input');
        
        let ws;
        function connect() {
          ws = new WebSocket('${wsUrl}');
          ws.onmessage = function(event) {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'frame') {
                img.src = 'data:image/jpeg;base64,' + data.data;
              } else if (data.type === 'error') {
                 document.body.innerHTML = '<div style="color:red;font-size:24px;text-align:center;padding:20px;">' + data.message + '</div>';
              }
            } catch(e) {
               img.src = 'data:image/jpeg;base64,' + event.data;
            }
          };
          ws.onclose = () => setTimeout(connect, 3000);
        }
        connect();

        function sendCoord(touch, type) {
          if(!ws || ws.readyState !== WebSocket.OPEN) return;
          const rect = img.getBoundingClientRect();
          let x = (touch.clientX - rect.left) / rect.width;
          let y = (touch.clientY - rect.top) / rect.height;
          x = Math.max(0, Math.min(1, x));
          y = Math.max(0, Math.min(1, y));
          ws.send(JSON.stringify({ action: type, x: x, y: y }));
        }

        let isDragging = false;
        let isHolding = false;
        let lastTapTime = 0;
        let initialTouchCount = 0;
        let lastTwoTouchX = 0;
        let lastTwoTouchY = 0;

        img.addEventListener('touchstart', function(e) {
          initialTouchCount = Math.max(initialTouchCount, e.touches.length);
          if (e.touches.length === 1) {
            isDragging = false;
            let now = Date.now();
            if (now - lastTapTime < 300) {
              // Double tap & hold -> Drag & Drop Mode
              isHolding = true;
              sendCoord(e.touches[0], 'mouse_down');
            }
            sendCoord(e.touches[0], 'move');
          } else if (e.touches.length === 2) {
             lastTwoTouchX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
             lastTwoTouchY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          }
        }, {passive: true});

        img.addEventListener('touchmove', function(e) {
          if (e.touches.length === 1) {
            isDragging = true;
            sendCoord(e.touches[0], 'move');
          } else if (e.touches.length === 2) {
             isDragging = true;
             let cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
             let cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
             let dx = cx - lastTwoTouchX;
             let dy = cy - lastTwoTouchY;
             
             // Scroll scaling: Linux X11 requires whole integers (1 or -1) to trigger mouse wheel events!
             if (Math.abs(dy) > 15) {
                 if (ws && ws.readyState === WebSocket.OPEN) {
                     // Fingers down (dy > 0) -> scroll up (dy = 1), Fingers up -> scroll down (dy = -1)
                     ws.send(JSON.stringify({ action: 'scroll', dx: 0, dy: dy > 0 ? 1 : -1 }));
                 }
                 lastTwoTouchY = cy;
             }
             if (Math.abs(dx) > 15) {
                 if (ws && ws.readyState === WebSocket.OPEN) {
                     ws.send(JSON.stringify({ action: 'scroll', dx: dx > 0 ? 1 : -1, dy: 0 }));
                 }
                 lastTwoTouchX = cx;
             }
          }
        }, {passive: true});

        img.addEventListener('touchend', function(e) {
          if (e.touches.length === 0) { // All fingers off
            if (initialTouchCount === 1) {
              if (isHolding) {
                // End drag & drop
                if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ action: 'mouse_up' }));
                isHolding = false;
              } else if (!isDragging) {
                // Single tap -> Left Click
                sendCoord(e.changedTouches[0], 'click');
                lastTapTime = Date.now();
              }
            } else if (initialTouchCount === 2) {
              if (!isDragging) {
                // Two-finger tap -> Right Click
                sendCoord(e.changedTouches[0], 'right_click');
              }
            }
            initialTouchCount = 0; // Reset for next interaction
          }
        }, {passive: true});

        // Modifiers logic
        document.getElementById('fab-toggle').onclick = () => {
             document.getElementById('fab-container').classList.toggle('hidden-btns');
        };
        
        document.getElementById('fn-toggle').onclick = () => {
             const fnBar = document.getElementById('fn-bar');
             fnBar.classList.toggle('hidden');
             document.getElementById('fn-toggle').innerText = fnBar.classList.contains('hidden') ? 'FN\u25B6' : 'FN\u25C0';
        };

        let activeMods = { ctrl: false, win: false, alt: false, shift: false };
        function toggleMod(btn, mod) {
          btn.onclick = () => {
            btn.classList.toggle('active');
            let state = btn.classList.contains('active') ? 'down' : 'up';
            activeMods[mod] = (state === 'down');
            // Do not send independent modifier ws events. Send them atomically with key presses.
          };
        }
        
        function clearMods() {
            ['ctrl', 'alt', 'win', 'shift'].forEach(mod => {
                if (activeMods[mod]) {
                    const btn = document.getElementById(mod + '-btn');
                    if (btn) btn.classList.remove('active');
                    activeMods[mod] = false;
                }
            });
        }

        toggleMod(document.getElementById('ctrl-btn'), 'ctrl');
        toggleMod(document.getElementById('win-btn'), 'win');
        toggleMod(document.getElementById('alt-btn'), 'alt');
        toggleMod(document.getElementById('shift-btn'), 'shift');

        // Keyboard logic
        kbdBtn.onclick = () => { kbdInput.focus(); };
        
        kbdInput.addEventListener('input', (e) => {
           if (e.data && ws && ws.readyState === WebSocket.OPEN) {
             let keyChar = e.data;
             // If a modifier is active, prevent auto-capitalization from triggering Shift behavior on the server
             if (activeMods.ctrl || activeMods.win || activeMods.alt) {
                 keyChar = keyChar.toLowerCase();
             }
             ws.send(JSON.stringify({ 
               action: 'key', 
               key: keyChar, 
               modifiers: activeMods 
             }));
             clearMods();
           }
           kbdInput.value = '';
        });
        
        kbdInput.addEventListener('keydown', (e) => {
           if (!ws || ws.readyState !== WebSocket.OPEN) return;
           if (e.key === 'Backspace' || e.key === 'Enter') {
             ws.send(JSON.stringify({ action: 'key', key: e.key }));
           } else if (e.key.length === 1 && (e.ctrlKey || e.altKey || e.metaKey)) {
             // Hardware keyboard shortcuts
             ws.send(JSON.stringify({ action: 'key', key: e.key.toLowerCase(), modifiers: { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, win: e.metaKey } }));
             e.preventDefault();
           }
        });
        
        window.sendSp = function(keyName) {
           if (ws && ws.readyState === 1) {
              ws.send(JSON.stringify({ action: 'key', key: keyName, modifiers: activeMods }));
              clearMods();
           }
        };
</script>
    </body>
    </html>
  `;

  return (
    <View style={tw`flex-1 bg-black`}>
      <WebView 
        source={{ html: htmlContent }}
        style={{ flex: 1, backgroundColor: 'black' }}
        scalesPageToFit={true}
        bounces={false}
      />
      <TouchableOpacity 
        style={{ position: 'absolute', top: 20, left: 20, backgroundColor: 'rgba(20,20,20,0.8)', padding: 10, paddingHorizontal: 15, borderRadius: 25, zIndex: 9999, flexDirection: 'row', alignItems: 'center', borderColor: 'rgba(255,255,255,0.2)', borderWidth: 1 }}
        onPress={() => navigation.navigate('Dashboard')}
      >
        <X color="white" size={18} style={{ marginRight: 6 }} />
        <Text style={{ color: 'white', fontWeight: 'bold' }}>Exit</Text>
      </TouchableOpacity>
    </View>
  );
}










export default function App() {
  useEffect(() => {
    const initBackgroundServices = async () => {
      try {
        // 1. Request POST_NOTIFICATIONS permission (Android 13+)
        if (Platform.OS === 'android' && Platform.Version >= 33) {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        }
        
        // 2. Request Notification Listener permission (reads all notifications)
        const status = await RNAndroidNotificationListener.getPermissionStatus();
        if (status !== 'authorized') {
          Alert.alert(
            "Notification Access Required",
            "To forward phone notifications to your desktop, this app needs Notification Access permission. Tap OK to open Settings, then enable it for 'Rakesh Laptop'.",
            [
              { text: "Later", style: "cancel" },
              { text: "OK", onPress: () => RNAndroidNotificationListener.requestPermission() }
            ]
          );
        }

        // 3. Start the foreground service to keep the app alive in background
        if (NativeModules.BackgroundService) {
          NativeModules.BackgroundService.startService();
          console.log('[BackgroundService] Foreground service started');
        }

        // 4. Request battery optimization exemption
        if (NativeModules.BackgroundService) {
          const isExempt = await NativeModules.BackgroundService.isIgnoringBatteryOptimizations();
          if (!isExempt) {
            setTimeout(() => {
              Alert.alert(
                "Disable Battery Optimization",
                "To keep notification forwarding active in the background, please disable battery optimization for this app.",
                [
                  { text: "Later", style: "cancel" },
                  { text: "Disable", onPress: () => NativeModules.BackgroundService.requestBatteryOptimizationExemption() }
                ]
              );
            }, 2000); // Delay so it doesn't stack with the notification permission dialog
          }
        }

      } catch (e) {
        console.log("Permission/service error:", e);
      }
    };
    initBackgroundServices();
  }, []);

  const [apiBase, setApiBase] = useState('http://100.67.104.120:62007/api/system');
  
  useEffect(() => {
    AsyncStorage.getItem('apiBase').then(val => {
      const url = val || 'http://100.67.104.120:62007/api/system';
      if (val) setApiBase(val);
      // Save API URL to native SharedPreferences for the foreground service
      if (NativeModules.BackgroundService) {
        NativeModules.BackgroundService.setApiUrl(url);
      }
    });
  }, []);
  
  const handleSetApiBase = (val) => {
    setApiBase(val);
    AsyncStorage.setItem('apiBase', val);
    // Update native service with new API URL
    if (NativeModules.BackgroundService) {
      NativeModules.BackgroundService.setApiUrl(val);
    }
  };

  return (
    <SafeAreaProvider>
    <ApiContext.Provider value={{ apiBase, setApiBase: handleSetApiBase }}>
      <NavigationContainer>
        <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: tw`bg-surface-dim border-t-0 shadow-none elevation-0 h-16 pb-2 pt-1`,
          tabBarLabelStyle: tw`text-[10px] font-bold pb-1`,
          tabBarIconStyle: tw`mt-0`,
          tabBarActiveTintColor: tw.color('primary'),
          tabBarInactiveTintColor: tw.color('outline-variant'),
        }}
      >
        <Tab.Screen 
          name="Dashboard" 
          component={DashboardScreen} 
          options={{ tabBarIcon: ({ color }) => <Home color={color} size={24} /> }} 
        />
        <Tab.Screen 
          name="System" 
          component={SystemScreen} 
          options={{ tabBarIcon: ({ color }) => <Activity color={color} size={24} /> }} 
        />
        <Tab.Screen 
          name="Terminal" 
          component={TerminalScreen} 
          options={{ tabBarIcon: ({ color }) => <TerminalIcon color={color} size={24} /> }} 
        />
        <Tab.Screen 
          name="Phone Share" 
          component={PhoneShareScreen} 
          options={{ tabBarItemStyle: { display: 'none' } }} 
        />
        <Tab.Screen 
          name="Remote" 
          component={RemoteScreen} 
          options={{ tabBarIcon: ({ color }) => <Monitor color={color} size={24} /> }} 
        />
        <Tab.Screen 
          name="Files" 
          component={FilesScreen} 
          options={{ tabBarIcon: ({ color }) => <Folder color={color} size={24} /> }} 
        />
        <Tab.Screen 
          name="InputPad" 
          component={InputControlScreen} 
          options={{ tabBarItemStyle: { display: 'none' } }} 
        />
      </Tab.Navigator>
    </NavigationContainer>
    </ApiContext.Provider>
    </SafeAreaProvider>
  );
}
