const fs = require('fs');
let code = fs.readFileSync('App.js', 'utf8');

// Replace the duplicate un-patched block
const duplicate = `const sleep = (time) => new Promise((resolve) => setTimeout(() => resolve(), time));
const backgroundTask = async (taskDataArguments) => {
    const { delay } = taskDataArguments;
    await new Promise(async (resolve) => {
        for (let i = 0; BackgroundJob.isRunning(); i++) {
            await sleep(delay);
        }
    });
};

const backgroundOptions = {
    taskName: 'StitchDashboard',
    taskTitle: 'Stitch Background Sync',
    taskDesc: 'Running to sync notifications & screen sharing',
    taskIcon: { name: 'ic_launcher', type: 'mipmap' },
    color: '#00ff00',
    parameters: { delay: 5000 },
};`;

code = code.replace(duplicate, "");
fs.writeFileSync('App.js', code);
