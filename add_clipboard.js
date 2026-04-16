const fs = require('fs');

let code = fs.readFileSync('/home/rakesh-singh/Documents/LAPTOP ACCESS/frontend/App.js', 'utf8');

// 1. Add new imports
const importStatements = `import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
`;
code = code.replace("import React, { useState", importStatements + "import React, { useState");


// 2. Dashboard Clipboard controls
const systemDashboardEnd = `        <View style={tw\`bg-surface-container-low p-6 rounded-md mb-6\`}>
          <View style={tw\`flex-row items-center justify-between mb-4\`}>
            <Text style={tw\`text-secondary text-xs font-bold tracking-widest\`}>STORAGE</Text>
          </View>
          <Text style={tw\`text-4xl text-on-surface font-bold tracking-wider\`}>
            {metrics ? (metrics.disk_usage.used / 1e9).toFixed(1) : '--'} <Text style={tw\`text-lg text-outline\`}>GB</Text>
          </Text>
          {metrics && (
              <Text style={tw\`text-outline text-xs mt-2\`}>Total: {(metrics.disk_usage.total / 1e9).toFixed(1)} GB</Text>
          )}
        </View>

      </ScrollView>`;

const dashboardExtras = `        <View style={tw\`bg-surface-container-low p-6 rounded-md mb-6\`}>
          <View style={tw\`flex-row items-center justify-between mb-4\`}>
            <Text style={tw\`text-secondary text-xs font-bold tracking-widest\`}>STORAGE</Text>
          </View>
          <Text style={tw\`text-4xl text-on-surface font-bold tracking-wider\`}>
            {metrics ? (metrics.disk_usage.used / 1e9).toFixed(1) : '--'} <Text style={tw\`text-lg text-outline\`}>GB</Text>
          </Text>
          {metrics && (
              <Text style={tw\`text-outline text-xs mt-2\`}>Total: {(metrics.disk_usage.total / 1e9).toFixed(1)} GB</Text>
          )}
        </View>

        <View style={tw\`bg-surface-container-low p-6 rounded-md mb-6\`}>
          <Text style={tw\`text-secondary text-xs font-bold tracking-widest mb-4\`}>CLIPBOARD SYNC</Text>
          <View style={tw\`flex-row gap-3\`}>
            <TouchableOpacity onPress={async () => {
              try {
                const { data } = await axios.get(\`\${apiBase}/clipboard\`);
                if(data.text) {
                  await Clipboard.setStringAsync(data.text);
                  Alert.alert("Success", "Copied from PC to Phone");
                } else {
                  Alert.alert("Info", data.error || "PC Clipboard is empty");
                }
              } catch(e) { Alert.alert("Error", "Could not fetch PC clipboard"); }
            }} style={tw\`flex-1 bg-primary text-center py-3 rounded-md\`}>
              <Text style={tw\`text-on-primary font-bold text-center\`}>⬇️ Fetch PC Text</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={async () => {
              try {
                const text = await Clipboard.getStringAsync();
                if(text) {
                  await axios.post(\`\${apiBase}/clipboard\`, { text });
                  Alert.alert("Success", "Sent to PC Clipboard");
                } else {
                  Alert.alert("Info", "Phone clipboard is empty");
                }
              } catch(e) { Alert.alert("Error", "Could not send to PC"); }
            }} style={tw\`flex-1 bg-surface-container py-3 rounded-md\`}>
              <Text style={tw\`text-on-surface font-bold text-center\`}>⬆️ Send to PC</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>`;

code = code.replace(systemDashboardEnd, dashboardExtras);

// 3. Upload File UI in FilesScreen
const viewFilesTop = `<View style={tw\`flex-row items-center mb-4 gap-3\`}>
          <TouchableOpacity onPress={handleUp} style={tw\`bg-surface-container p-3 rounded-md\`}>
            <Text style={tw\`text-on-surface font-bold text-xs\`}>↑ UP</Text>
          </TouchableOpacity>
          <View style={tw\`flex-1 bg-surface-container px-4 py-3 rounded-md\`}>
            <Text style={tw\`text-on-surface tracking-wider font-mono text-xs\`} numberOfLines={1}>{currentPath || 'Loading...'}</Text>
          </View>
        </View>`;

const addUploadBtn = `<View style={tw\`flex-row items-center mb-4 gap-3\`}>
          <TouchableOpacity onPress={handleUp} style={tw\`bg-surface-container p-3 rounded-md\`}>
            <Text style={tw\`text-on-surface font-bold text-xs\`}>↑ UP</Text>
          </TouchableOpacity>
          <View style={tw\`flex-1 bg-surface-container px-4 py-3 rounded-md\`}>
            <Text style={tw\`text-on-surface tracking-wider font-mono text-xs\`} numberOfLines={1}>{currentPath || 'Loading...'}</Text>
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
                  await axios.post(\`\${apiBase}/file/upload?path=\${encodeURIComponent(currentPath)}\`, formData, { headers: { "Content-Type": 'multipart/form-data' }});
                  Alert.alert("Success", "File uploaded to PC!");
                  fetchFiles(currentPath);
                }
              } catch(e) { Alert.alert("Error", "Upload failed"); }
          }} style={tw\`bg-primary p-3 rounded-md\`}>
             <Text style={tw\`text-on-primary font-bold text-xs\`}>+ Upload</Text>
          </TouchableOpacity>
        </View>`;

code = code.replace(viewFilesTop, addUploadBtn);

fs.writeFileSync('/home/rakesh-singh/Documents/LAPTOP ACCESS/frontend/App.js', code);
