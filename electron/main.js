const { app, BrowserWindow, Menu } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

let mainWindow;
let pythonProcess;

// Function to check if port is open
function waitForPort(port, host = '127.0.0.1', timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const tryConnect = () => {
      const socket = new net.Socket();
      
      socket.setTimeout(100);
      socket.on('connect', () => {
        socket.destroy();
        resolve();
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout waiting for Flask server'));
        } else {
          setTimeout(tryConnect, 500);
        }
      });
      
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout waiting for Flask server'));
        } else {
          setTimeout(tryConnect, 500);
        }
      });
      
      socket.connect(port, host);
    };
    
    tryConnect();
  });
}

// Function to start Python backend
async function startPythonBackend() {
  return new Promise((resolve, reject) => {
    let pythonPath;
    let pythonArgs;
    
    if (app.isPackaged) {
      // In production, use the bundled executable
      pythonPath = path.join(process.resourcesPath, 'python', 'monitor.exe');
      pythonArgs = [];
    } else {
      // In development, use Python directly
      pythonPath = 'python';
      pythonArgs = [path.join(__dirname, '..', 'backend', 'monitor.py')];
    }
    
    console.log('Starting Python backend:', pythonPath, pythonArgs);
    
    pythonProcess = spawn(pythonPath, pythonArgs, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    pythonProcess.stdout.on('data', (data) => {
      console.log(`Python stdout: ${data}`);
    });
    
    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python stderr: ${data}`);
    });
    
    pythonProcess.on('error', (error) => {
      console.error('Failed to start Python process:', error);
      reject(error);
    });
    
    pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code ${code}`);
      pythonProcess = null;
    });
    
    // Wait for Flask server to be ready
    waitForPort(5080)
      .then(() => {
        console.log('Flask server is ready');
        resolve();
      })
      .catch((error) => {
        console.error('Flask server failed to start:', error);
        if (pythonProcess) {
          pythonProcess.kill();
        }
        reject(error);
      });
  });
}

// Function to stop Python backend
function stopPythonBackend() {
  if (pythonProcess) {
    console.log('Stopping Python backend...');
    
    // Try graceful shutdown first
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', pythonProcess.pid, '/f', '/t']);
    } else {
      pythonProcess.kill('SIGTERM');
    }
    
    // Force kill after timeout
    setTimeout(() => {
      if (pythonProcess) {
        pythonProcess.kill('SIGKILL');
      }
    }, 5000);
  }
}

// Create the main window
function createWindow() {
  // Create custom menu
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) {
              mainWindow.reload();
            }
          }
        },
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle DevTools',
          accelerator: 'F12',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.toggleDevTools();
            }
          }
        },
        {
          label: 'Toggle Fullscreen',
          accelerator: 'F11',
          click: () => {
            if (mainWindow) {
              mainWindow.setFullScreen(!mainWindow.isFullScreen());
            }
          }
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '..', 'backend', 'static', 'monitor_icon.png'),
    title: 'uDBM - Realtime Database Monitor'
  });
  
  // Load the Flask application
  mainWindow.loadURL('http://127.0.0.1:5080');
  
  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App event handlers
app.whenReady().then(async () => {
  try {
    await startPythonBackend();
    createWindow();
  } catch (error) {
    console.error('Failed to start application:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  stopPythonBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  stopPythonBackend();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  stopPythonBackend();
  app.quit();
});
