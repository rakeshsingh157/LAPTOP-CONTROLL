const fs = require('fs');
let code = fs.readFileSync('frontend/App.js', 'utf-8');

// 1. Let's fix the imports first. Let's replace 'react-native' imports.
code = code.replace(
  /import \{ View, Text, TextInput, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, NativeModules, Alert, Modal, Linking \} from 'react-native';/,
  "import { View, Text, TextInput, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, NativeModules, Alert, Modal, Linking, Image } from 'react-native';\nimport { WebView } from 'react-native-webview';"
);

// 2. Replace the FilesScreen entirely
const newFilesScreen = `function FilesScreen() {
  const [currentPath, setCurrentPath] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // File viewer state
  const [viewFile, setViewFile] = useState(null);
  const [fileType, setFileType] = useState('text'); // text, image, pdf, etc
  const [fileContent, setFileContent] = useState('');
  const [savingFile, setSavingFile] = useState(false);

  const fetchFiles = async (path = null) => {
    setLoading(true);
    try {
      const url = path ? \`\${API_BASE}/files?path=\${encodeURIComponent(path)}\` : \`\${API_BASE}/files\`;
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
      const textExtensions = ['.txt', '.js', '.jsx', '.ts', '.tsx', '.json', '.py', '.md', '.html', '.css', '.yml', '.yaml', '.csv', '.log', '.env', '.sh', '.xml'];
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
          const { data } = await axios.get(\`\${API_BASE}/file/read?path=\${encodeURIComponent(item.path)}\`);
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
      await axios.post(\`\${API_BASE}/file/write\`, {
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

  const handleLongPress = (item) => {
    Alert.alert(
      "File Options",
      \`\${item.name}\`,
      [
        { text: "Delete", style: "destructive", onPress: () => confirmDelete(item) },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const confirmDelete = (item) => {
    Alert.alert("Confirm", \`Are you sure you want to delete \${item.name}?\`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          try {
            await axios.delete(\`\${API_BASE}/file/delete?path=\${encodeURIComponent(item.path)}\`);
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
    <SafeAreaView style={tw\`flex-1 bg-surface-dim\`}>
      <ScrollView contentContainerStyle={tw\`p-6 pt-10\`}>
        <View style={tw\`flex-row items-center mb-8 gap-3\`}>
          <TouchableOpacity onPress={handleUp} style={tw\`bg-surface-container p-3 rounded-md\`}>
            <Text style={tw\`text-on-surface font-bold text-xs\`}>↑ UP</Text>
          </TouchableOpacity>
          <View style={tw\`flex-1 bg-surface-container px-4 py-3 rounded-md\`}>
            <Text style={tw\`text-on-surface tracking-wider font-mono text-xs\`} numberOfLines={1}>{currentPath || 'Loading...'}</Text>
          </View>
        </View>

        <Text style={tw\`text-outline text-xs tracking-widest mb-4\`}>DIRECTORY CONTENTS (Long press options)</Text>
        
        {loading && !viewFile ? (
          <ActivityIndicator color={tw.color('primary')} size="large" style={tw\`mt-10\`} />
        ) : (
          files.map((item, idx) => (
            <TouchableOpacity 
              key={idx} 
              onPress={() => handlePress(item)} 
              onLongPress={() => handleLongPress(item)}
              style={tw\`bg-surface-container-low p-4 rounded-md mb-3 flex-row items-center\`}
            >
              <Folder color={item.is_dir ? tw.color('primary') : tw.color('outline')} size={24} style={tw\`mr-4\`} />
              <View style={tw\`flex-1\`}>
                <Text style={tw\`text-on-surface font-bold text-base\`} numberOfLines={1}>{item.name}</Text>
                <Text style={tw\`text-outline text-xs font-mono mt-1\`}>
                  {item.is_dir ? 'DIR' : \`\${(item.size / 1024).toFixed(1)} KB\`}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal visible={!!viewFile} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={tw\`flex-1 bg-surface-dim\`}>
          <View style={tw\`flex-row justify-between items-center p-4 bg-surface-container-low\`}>
            <Text style={tw\`text-on-surface font-bold flex-1 mr-4\`} numberOfLines={1}>
              {viewFile ? viewFile.name : ''} {loading && ' (Loading...)'}
            </Text>
            <View style={tw\`flex-row gap-2\`}>
              {fileType === 'text' && (
                <TouchableOpacity onPress={handleSaveFile} style={tw\`bg-primary px-4 py-2 rounded-md\`}>
                  <Text style={tw\`text-on-primary font-bold\`}>{savingFile ? 'Saving...' : 'Save'}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => { setViewFile(null); setFileContent(''); setFileType('text') }} style={tw\`bg-surface-container-highest px-4 py-2 rounded-md\`}>
                <Text style={tw\`text-on-surface font-bold\`}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {fileType === 'text' && (
            <TextInput
              style={tw\`flex-1 p-4 text-on-surface font-mono text-xs bg-black\`}
              multiline
              textAlignVertical="top"
              value={fileContent}
              onChangeText={setFileContent}
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}

          {fileType === 'image' && viewFile && (
            <View style={tw\`flex-1 bg-black justify-center items-center\`}>
                <Image 
                    source={{ uri: \`\${API_BASE}/file/download?path=\${encodeURIComponent(viewFile.path)}\` }} 
                    style={tw\`w-full h-full\`} 
                    resizeMode="contain" 
                />
            </View>
          )}

          {fileType === 'other' && viewFile && (
            <WebView 
              source={{ uri: \`\${API_BASE}/file/download?path=\${encodeURIComponent(viewFile.path)}\` }} 
              style={tw\`flex-1\`} 
            />
          )}

        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {`;

code = code.replace(/function FilesScreen\(\) \{[\s\S]*?export default function App\(\) \{/, newFilesScreen);

fs.writeFileSync('frontend/App.js', code);
