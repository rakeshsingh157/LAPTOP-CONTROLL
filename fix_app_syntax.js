const fs = require('fs');

let content = fs.readFileSync('frontend/App.js', 'utf8');

// The replacement script had escaped backslashes like \\\` and \\\${
// Let's fix them back to normal backticks and template string dollars
content = content.replace(/\$\{API_BASE\}\/files\?path=\$\{encodeURIComponent\(path\)\}/g, "\\\`\\$\\{API_BASE\\}/files?path=\\$\\{encodeURIComponent(path)\\}\\\`");
content = content.replace(/\$\{API_BASE\}\/files/g, "\\\`\\$\\{API_BASE\\}/files\\\`");

// Let's just fix it by replacing the whole function since it's easier to get wrong with regex
