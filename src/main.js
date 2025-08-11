const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');

// Keep a global reference of the window object
let mainWindow;
let pythonProcess;
let flaskPort = 5046; // Default port

// Function to find a free port using Node.js built-in modules
function findFreePort(startPort = 5046, maxPort = 5100) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    function tryPort(port) {
      if (port > maxPort) {
        reject(new Error(`No free port found between ${startPort} and ${maxPort}`));
        return;
      }

      server.listen(port, (err) => {
        if (err) {
          // Port is in use, try next one
          tryPort(port + 1);
        } else {
          // Port is free
          server.close(() => {
            resolve(port);
          });
        }
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          // Port is in use, try next one
          tryPort(port + 1);
        } else {
          reject(err);
        }
      });
    }

    tryPort(startPort);
  });
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../static/monitor_icon.png'),
    show: false // Don't show until ready
  });

  // Start Python Flask server
  startPythonServer().then(() => {
    // Load the Flask app
    mainWindow.loadURL(`http://localhost:${flaskPort}`);
    
    // Show window when ready
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });
  }).catch(err => {
    console.error('Failed to start Python server:', err);
    // Fallback: show error page or exit
    app.quit();
  });

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function startPythonServer() {
  return new Promise(async (resolve, reject) => {
    try {
      // Find a free port
      const freePort = await findFreePort(5046, 5100);
      flaskPort = freePort;
      
      // Determine Python executable path
      let pythonExePath;
      if (app.isPackaged) {
        // In packaged app, use bundled Python executable
        const platform = process.platform;
        if (platform === 'win32') {
          pythonExePath = path.join(process.resourcesPath, 'python', 'monitor.exe');
        } else {
          pythonExePath = path.join(process.resourcesPath, 'python', 'monitor');
        }
      } else {
        // In development, use Python from virtual environment
        const platform = process.platform;
        if (platform === 'win32') {
          pythonExePath = path.join(__dirname, '../venv/Scripts/python.exe');
        } else {
          pythonExePath = path.join(__dirname, '../venv/bin/python');
        }
      }

      // Start Python process
      const args = app.isPackaged ? [] : [path.join(__dirname, '../monitor.py')];
      
      pythonProcess = spawn(pythonExePath, args, {
        env: { ...process.env, FLASK_PORT: flaskPort.toString() }
      });

      pythonProcess.stdout.on('data', (data) => {
        console.log(`Python: ${data}`);
      });

      pythonProcess.stderr.on('data', (data) => {
        console.error(`Python Error: ${data}`);
      });

      pythonProcess.on('close', (code) => {
        console.log(`Python process exited with code ${code}`);
      });

      // Wait for server to be ready
      setTimeout(() => {
        resolve();
      }, 3000); // Give Flask 3 seconds to start

    } catch (error) {
      reject(error);
    }
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(createWindow);

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // Kill Python process
  if (pythonProcess) {
    pythonProcess.kill();
  }
  
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle app quit
app.on('before-quit', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
});
