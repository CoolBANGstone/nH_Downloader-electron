const {
    app,
    BrowserWindow,
    dialog,
    Menu,
    MenuItem
} = require('electron');
const fs = require('fs');
const url = require('url');
const path = require('path');
const open = require('open');
const request = require('request');
const pkg = require('./package.json');
const compareVersions = require('compare-versions');

UserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:68.0) Gecko/20100101 Firefox/68.0';

var downloadFolder;
var loginCookies = '';

app.on('ready', () => {
    setMainMenu();
    createWindow();
});

app.on('window-all-closed', () => {
    // darwin = MacOS
    // if (process.platform !== 'darwin') {
    app.quit();
    // }
});

app.on('activate', () => {
    if (win === null) {
        createWindow();
    }
});
function setMainMenu() {
    const isMac = process.platform === 'darwin';

    const template = [
    ...(isMac ? [{
        label: app.name,
        submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideothers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
        ]
    }] : []),
    // { role: 'fileMenu' }
    {
        label: 'File',
        submenu: [
            {
                label: 'Open Folder...',
                accelerator: 'CmdOrCtrl+O',
                click: () => {open_file_dialog();}
            },
            {
                label: 'Login Window',
                accelerator: 'CmdOrCtrl+L',
                click: () => {createLoginWindow();}
            },
            isMac ? { role: 'close' } : { role: 'quit' }
        ]
    },
    // { role: 'editMenu' }
    {
        label: 'Edit',
        submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            ...(isMac ? [
                { role: 'pasteAndMatchStyle' },
                { role: 'delete' },
                { role: 'selectAll' },
                { type: 'separator' },
                {
                    label: 'Speech',
                    submenu: [
                        { role: 'startspeaking' },
                        { role: 'stopspeaking' }
                    ]
                }
            ] : [
                { role: 'delete' },
                { type: 'separator' },
                { role: 'selectAll' }
             ])
            ]
        },
        // { role: 'viewMenu' }
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forcereload' },
                { role: 'toggledevtools' },
                { type: 'separator' },
                { role: 'resetzoom' },
                { role: 'zoomin' },
                { role: 'zoomout' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        // { role: 'windowMenu' }
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                ...(isMac ? [
                    { type: 'separator' },
                    { role: 'front' },
                    { type: 'separator' },
                    { role: 'window' }
                ] : [
                    { role: 'close' }
                ])
            ]
        },
        {
            role: 'help',
            submenu: [{
                label: 'Learn More',
                click: async () => {
                    const { shell } = require('electron')
                    await shell.openExternal('https://electronjs.org')
                }
            }
            ]
        }
    ]
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
function open_file_dialog() {
    if (process.platform === 'darwin') {
        const window = win;
        dialog.showOpenDialog(window, { properties: [ 'openDirectory', 'openFile' ]}, function (folder) {
            if (folder)  {
                folder = folder[0];
                win.webContents.send('selected-directory', folder);
                downloadFolder = folder;
                console.log(downloadFolder);
                loadCookies();
                saveCookies();
            }
        });
    }else
        dialog.showOpenDialog({properties: [ 'openDirectory', 'openFile' ]}, function (folder) {
            if (folder)  {
                folder = folder[0];
                win.webContents.send('selected-directory', folder);
                downloadFolder = folder;
                loadCookies();
                saveCookies();
            }
        })
}
function createLoginWindow() {
    var transparent = process.platform === 'darwin';
    win2 = new BrowserWindow({
        width: 500,
        height: 700,
        maximizable: false,
        transparent: transparent,
        backgroundColor: "#404040",
        webPreferences: {
            nodeIntegration: true
        }
    });
    const loginURL = 'https://nhentai.net/login';
    win2.loadURL(loginURL).then(async() => {
        try {
            while (1) {
                if (win2.webContents.getURL().indexOf('login') === -1) {
                    const session = win2.webContents.session;
                    session.cookies.get({url : 'https://nhentai.net'}, function(error, cookies) {
                        loginCookies = '';
                        for (var i = 0; i < cookies.length; i++) {
                            var info = cookies[i];
                            loginCookies += `${info.name}=${info.value}; `;
                        }
                        console.log(loginCookies);
                        saveCookies();
                    });
                    win2.close();
                    break;
                }
                await sleep(100);
            }
        }catch(err) {

        }
    })
}
function createWindow() {
    // Create the browser window.
    var transparent = process.platform === 'darwin';
    win = new BrowserWindow({
        width: 500,
        height: 500,
        maximizable: false,
        transparent: transparent,
        backgroundColor: "#404040",
        webPreferences: {
            nodeIntegration: true
        }
    });


    win.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    // Open DevTools.
    // win.webContents.openDevTools()
    if (process.platform !== 'darwin') {
        win.removeMenu();
    }
    // When Window Close.
    win.on('closed', () => {
        win = null;
    })
    win.webContents.on('did-finish-load', () => {
        downloadFolder = path.join(app.getPath('downloads'), 'nH_Downloader');
        fs.mkdir(downloadFolder, function(err) {});
        win.webContents.send('selected-directory', downloadFolder);
        loadCookies();
    })
    // Check new version
    request({
        url: 'https://api.github.com/repos/coolbangstone/nH_Downloader-electron/releases/latest',
        headers: {'User-Agent': UserAgent}}, function(err, resp, body) {
        if (err || resp.statusCode !== 200)
            return;
        body = JSON.parse(body);
        current_version = pkg.version;
        latest_version = body.name;
        console.log(latest_version , current_version);
        if (compareVersions(current_version, latest_version) === -1) {
            const options = {
                type: 'question',
                buttons: [ 'Yes', 'No'],
                defaultId: 0,
                title: 'Question',
                message: `Do you want to download now?`,
                detail: `New version ${latest_version} found.`,
            };
            dialog.showMessageBox(null, options, (response) => {
                if (response === 0) {
                    var platform = process.platform === 'darwin' ? 0 : 1;
                    var url = body.assets[platform].browser_download_url;
                    var name = body.assets[platform].name;
                    request({url: url}).on('error', function(err) {return;}).pipe(fs.createWriteStream(path.join(app.getPath('downloads'), name))).on('close', function() {
                        const options = {
                            type: 'question',
                            buttons: [ 'Yes', 'No'],
                            defaultId: 0,
                            title: 'Question',
                            message: `Download complete! Close and install update now?`,
                        };
                        dialog.showMessageBox(null, options, async(response) => {
                            if (response === 0) {
                                open(path.join(app.getPath('downloads'), name));
                                await sleep(3000);
                                app.quit();
                            }
                        });
                    });
                }
            });
        }
    })
}

function saveCookies() {
    if (loginCookies === '') {
        return;
    }
    fs.writeFile(path.join(downloadFolder, 'cookies.json'), String(loginCookies), (err) => {
        if (err) {
            return console.log(err);
        }
    });
}
function loadCookies() {
    fs.readFile(path.join(downloadFolder, 'cookies.json'), (err, data) => {
        if (err) {
            return;
        }
        loginCookies = data;
    });
}
function sleep(ms){
    return new Promise(resolve => {
        setTimeout(resolve, ms)
    })
}