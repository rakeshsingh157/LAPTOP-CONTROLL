const fs = require('fs');
let code = fs.readFileSync('/home/rakesh-singh/Documents/LAPTOP ACCESS/frontend/App.js', 'utf8');

// 1. Add new Lucide icons to the import
const oldImport = "import { Home, Activity, Terminal as TerminalIcon, Folder } from 'lucide-react-native';";
const newImport = "import { Home, Activity, Terminal as TerminalIcon, Folder, Download, Upload, Search, ArrowUp, UploadCloud } from 'lucide-react-native';";
if (code.includes(oldImport)) {
  code = code.replace(oldImport, newImport);
} else if (!code.includes("UploadCloud")) {
  // Fallback if import is different
  code = code.replace(
    "} from 'lucide-react-native';",
    ", Download, Upload, Search, ArrowUp, UploadCloud } from 'lucide-react-native';"
  );
}

// 2. Replace Clipboard Buttons
code = code.replace(
  /<Text style=\{tw`text-on-primary font-bold text-center`\}>⬇️ Fetch PC Text<\/Text>/g,
  "<View style={tw`flex-row justify-center items-center`}><Download color={tw.color('on-primary')} size={18} style={tw`mr-2`} /><Text style={tw`text-on-primary font-bold`}>Fetch from PC</Text></View>"
);

code = code.replace(
  /<Text style=\{tw`text-on-surface font-bold text-center`\}>⬆️ Send to PC<\/Text>/g,
  "<View style={tw`flex-row justify-center items-center`}><Upload color={tw.color('on-surface')} size={18} style={tw`mr-2`} /><Text style={tw`text-on-surface font-bold`}>Send to PC</Text></View>"
);

// 3. Replace FilesScreen "UP" Button
code = code.replace(
  /<Text style=\{tw`text-on-surface font-bold text-xs`\}>↑ UP<\/Text>/g,
  "<View style={tw`flex-row items-center`}><ArrowUp color={tw.color('on-surface')} size={16} /><Text style={tw`text-on-surface font-bold text-xs ml-1`}>UP</Text></View>"
);

// 4. Replace FilesScreen "+ Upload" Button
code = code.replace(
  /<Text style=\{tw`text-on-primary font-bold text-xs`\}>\+ Upload<\/Text>/g,
  "<View style={tw`flex-row items-center`}><UploadCloud color={tw.color('on-primary')} size={16} style={tw`mr-1`} /><Text style={tw`text-on-primary font-bold text-xs`}>Upload</Text></View>"
);

// 5. Remove Search Emoji
code = code.replace(
  /placeholder="🔎 Search files..."/g,
  'placeholder="Search files..."'
);

fs.writeFileSync('/home/rakesh-singh/Documents/LAPTOP ACCESS/frontend/App.js', code);
