with open('/home/rakesh-singh/Documents/LAPTOP ACCESS/frontend/App.js', 'r') as f:
    text = f.read()

# Update onmessage logic to parse JSON instead of pure base64
old_onmessage = """      ws.current.onmessage = (e) => {
        setFrame(`data:image/jpeg;base64,${e.data}`);
      };"""

new_onmessage = """      ws.current.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.type === 'frame') {
            setFrame(`data:image/jpeg;base64,${payload.data}`);
            setScreenError(null);
          } else if (payload.type === 'error') {
            setScreenError(payload.message);
          }
        } catch(err) {
          // Fallback if not JSON
          setFrame(`data:image/jpeg;base64,${e.data}`);
        }
      };"""

if "JSON.parse(e.data)" not in text:
    text = text.replace(old_onmessage, new_onmessage)
    # Add screenError state
    text = text.replace("const [frame, setFrame] = useState(null);", "const [frame, setFrame] = useState(null);\n  const [screenError, setScreenError] = useState(null);")
    
    # Add error overlay to render view
    old_render = """      {frame ? (
        <Image 
          source={{ uri: frame }} """
          
    new_render = """      {screenError && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, padding: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 10 }}>
          <AlertTriangle color="red" size={64} style={{ marginBottom: 20 }}/>
          <Text style={{ color: 'white', fontSize: 18, textAlign: 'center', fontWeight: 'bold' }}>{screenError}</Text>
        </View>
      )}
      {frame ? (
        <Image 
          source={{ uri: frame }} """
          
    if "screenError &&" not in text:
        text = text.replace(old_render, new_render)
        
    with open('/home/rakesh-singh/Documents/LAPTOP ACCESS/frontend/App.js', 'w') as f:
        f.write(text)
