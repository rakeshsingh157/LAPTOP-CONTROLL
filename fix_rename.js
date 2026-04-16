const fs = require('fs');

let code = fs.readFileSync('/home/rakesh-singh/Documents/LAPTOP ACCESS/frontend/App.js', 'utf8');

// 1. Add state variables for rename
code = code.replace(
  "const [savingFile, setSavingFile] = useState(false);",
  "const [savingFile, setSavingFile] = useState(false);\n  const [renameItem, setRenameItem] = useState(null);\n  const [newName, setNewName] = useState('');"
);

// 2. Add handleRename function
const renameFunc = `
  const handleRename = async () => {
    if (!newName || !renameItem || newName === renameItem.name) {
      setRenameItem(null);
      return;
    }
    try {
      const parent = currentPath;
      const newPath = parent + '/' + newName;
      await axios.post(\`\${API_BASE}/file/rename\`, {
        old_path: renameItem.path,
        new_path: newPath
      });
      setRenameItem(null);
      fetchFiles(currentPath);
    } catch(e) {
      Alert.alert("Error", "Failed to rename item.");
    }
  };

  const handleLongPress`;

code = code.replace("const handleLongPress", renameFunc);

// 3. Update handleLongPress to include Rename
const newLongPress = `const handleLongPress = (item) => {
    Alert.alert(
      "File Options",
      \`\${item.name}\`,
      [
        { text: "Rename", onPress: () => { setRenameItem(item); setNewName(item.name); } },
        { text: "Delete", style: "destructive", onPress: () => confirmDelete(item) },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };`;
code = code.replace(/const handleLongPress = \(item\) => \{[\s\S]*?\}\];\n    \);\n  \};\n/m, newLongPress + '\n');
// Fallback if regex fails:
if (code.includes('const handleLongPress') && !code.includes('text: "Rename"')) {
    code = code.replace(/const handleLongPress = \(item\) => \{[\s\S]*?\}\);\n  \};/m, newLongPress);
}


// 4. Add the Rename Modal UI inside the primary return of FilesScreen
const renameModalUI = `
      {/* Rename Modal */}
      <Modal visible={!!renameItem} transparent={true} animationType="fade">
        <View style={tw\`flex-1 justify-center items-center bg-black/80 px-6\`}>
          <View style={tw\`bg-surface-container w-full p-6 rounded-lg\`}>
            <Text style={tw\`text-on-surface font-bold text-lg mb-4\`}>Rename</Text>
            <TextInput
              style={tw\`bg-surface-dim p-4 text-on-surface font-mono rounded-md mb-4\`}
              value={newName}
              onChangeText={setNewName}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={tw\`flex-row justify-end gap-3\`}>
              <TouchableOpacity onPress={() => setRenameItem(null)} style={tw\`px-4 py-2\`}>
                <Text style={tw\`text-on-surface\`}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleRename} style={tw\`bg-primary px-4 py-2 rounded-md\`}>
                <Text style={tw\`text-on-primary font-bold\`}>Rename</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!viewFile}`;

code = code.replace(/<Modal visible=\{\!\!viewFile\}/, renameModalUI);

fs.writeFileSync('/home/rakesh-singh/Documents/LAPTOP ACCESS/frontend/App.js', code);
