const fs = require('fs');

let code = fs.readFileSync('/home/rakesh-singh/Documents/LAPTOP ACCESS/frontend/App.js', 'utf8');

const oldFetchFn = `            <TouchableOpacity onPress={async () => {
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
              <View style={tw\`flex-row justify-center items-center\`}><Download color={tw.color('on-primary')} size={18} style={tw\`mr-2\`} /><Text style={tw\`text-on-primary font-bold\`}>Fetch from PC</Text></View>
            </TouchableOpacity>`;

const newFetchFn = `            <TouchableOpacity onPress={async () => {
              try {
                const { data } = await axios.get(\`\${apiBase}/clipboard\`);
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
            }} style={tw\`flex-1 bg-primary text-center py-3 rounded-md\`}>
              <View style={tw\`flex-row justify-center items-center\`}><Download color={tw.color('on-primary')} size={18} style={tw\`mr-2\`} /><Text style={tw\`text-on-primary font-bold\`}>Fetch from PC</Text></View>
            </TouchableOpacity>`;

const oldSendFn = `            <TouchableOpacity onPress={async () => {
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
              <View style={tw\`flex-row justify-center items-center\`}><Upload color={tw.color('on-surface')} size={18} style={tw\`mr-2\`} /><Text style={tw\`text-on-surface font-bold\`}>Send to PC</Text></View>
            </TouchableOpacity>`;

const newSendFn = `            <TouchableOpacity onPress={async () => {
              try {
                if (await Clipboard.hasImageAsync()) {
                  const clipImage = await Clipboard.getImageAsync({ format: 'png' });
                  if (clipImage && clipImage.data) {
                    await axios.post(\`\${apiBase}/clipboard\`, { type: 'image', content: clipImage.data });
                    Alert.alert("Success", "Image sent to PC Clipboard");
                    return;
                  }
                }
                const text = await Clipboard.getStringAsync();
                if(text && text.trim() !== "") {
                  await axios.post(\`\${apiBase}/clipboard\`, { type: 'text', content: text });
                  Alert.alert("Success", "Text sent to PC Clipboard");
                } else {
                  Alert.alert("Info", "Phone clipboard is empty");
                }
              } catch(e) { Alert.alert("Error", "Could not send to PC"); }
            }} style={tw\`flex-1 bg-surface-container py-3 rounded-md\`}>
              <View style={tw\`flex-row justify-center items-center\`}><Upload color={tw.color('on-surface')} size={18} style={tw\`mr-2\`} /><Text style={tw\`text-on-surface font-bold\`}>Send to PC</Text></View>
            </TouchableOpacity>`;

code = code.replace(oldFetchFn, newFetchFn).replace(oldSendFn, newSendFn);

fs.writeFileSync('/home/rakesh-singh/Documents/LAPTOP ACCESS/frontend/App.js', code);
