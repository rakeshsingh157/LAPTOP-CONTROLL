const fs = require('fs');

let code = fs.readFileSync('/home/rakesh-singh/Documents/LAPTOP ACCESS/frontend/App.js', 'utf8');

const oldSection = `  return (
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
        </Text>`;

const newSection = `  return (
    <SafeAreaView style={tw\`flex-1 bg-surface-dim\`}>
      <ScrollView contentContainerStyle={tw\`p-6 pt-10\`}>
        <View style={tw\`flex-row items-center justify-between mb-2\`}>
            <View>
              <Text style={tw\`text-3xl font-bold text-on-surface\`}>System<Text style={tw\`text-primary\`}>Dash</Text></Text>
              <View style={tw\`flex-row items-center mt-1\`}>
                <View style={tw\`w-2.5 h-2.5 rounded-full mr-2 \${status === 'live' ? 'bg-green-500' : status === 'checking' ? 'bg-yellow-500' : 'bg-red-500'}\`} />
                <Text style={tw\`text-on-surface-variant font-medium text-sm\`}>
                  {status === 'live' ? 'Online & Live' : status === 'checking' ? 'Connecting...' : 'Offline / Down'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => { setTempApi(apiBase); setEditApi(true); }} style={tw\`bg-surface-container rounded-full p-3\`}>
                <Activity color={tw.color('on-surface')} size={20} />
            </TouchableOpacity>
        </View>
        <Text style={tw\`text-outline mb-6 font-mono text-sm mt-2\`}>
          Active Uptime: {metrics ? formatUptime(metrics.uptime) : 'Waiting...'}
        </Text>

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

code = code.replace(oldSection, newSection);

fs.writeFileSync('/home/rakesh-singh/Documents/LAPTOP ACCESS/frontend/App.js', code);
