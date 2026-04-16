const fs = require('fs');
let code = fs.readFileSync('/home/rakesh-singh/Documents/LAPTOP ACCESS/frontend/App.js', 'utf8');

// 1. Add searchQuery state to FilesScreen
code = code.replace(
  "const [newName, setNewName] = useState('');",
  "const [newName, setNewName] = useState('');\n  const [searchQuery, setSearchQuery] = useState('');"
);

// 2. Filter files based on search query
const oldMap = `files.map((item, i) => (`;
const newMap = `files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())).map((item, i) => (`;
code = code.replace(oldMap, newMap);

// 3. Add search input UI below the current path and above the files list
const oldHeader = `<View style={tw\`px-4 py-3 bg-surface-container flex-row items-center border-b border-outline-variant\`}>
        {currentPath !== '/' && currentPath !== 'C:\\\\' && currentPath !== '' && (
          <TouchableOpacity onPress={handleUp} style={tw\`mr-3\`}>
            <Text style={tw\`text-primary font-bold\`}>← Up</Text>
          </TouchableOpacity>
        )}
        <Text style={tw\`text-on-surface font-mono text-sm\`}>{currentPath || '/'}</Text>
      </View>`;

const newHeader = `<View style={tw\`px-4 py-3 bg-surface-container flex-col border-b border-outline-variant\`}>
        <View style={tw\`flex-row items-center\`}>
          {currentPath !== '/' && currentPath !== 'C:\\\\' && currentPath !== '' && (
            <TouchableOpacity onPress={handleUp} style={tw\`mr-3\`}>
              <Text style={tw\`text-primary font-bold\`}>← Up</Text>
            </TouchableOpacity>
          )}
          <Text style={tw\`text-on-surface font-mono text-sm\`}>{currentPath || '/'}</Text>
        </View>
        <TextInput
          style={tw\`bg-surface-dim mt-3 px-4 py-2 rounded text-on-surface font-mono\`}
          placeholder="Search files..."
          placeholderTextColor={tw.color('outline-variant')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>`;
code = code.replace(oldHeader, newHeader);

// In case the oldHeader wasn't matched properly, let's just make sure the file is written correctly.
fs.writeFileSync('/home/rakesh-singh/Documents/LAPTOP ACCESS/frontend/App.js', code);
