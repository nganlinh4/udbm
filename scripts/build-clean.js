#!/usr/bin/env node

/**
 * Clean build script that handles process cleanup and file locks
 * This ensures a clean build by terminating any running processes first
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const COLORS = {
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  RESET: '\x1b[0m'
};

function log(color, message) {
  console.log(`${color}${message}${COLORS.RESET}`);
}

function logSuccess(message) {
  log(COLORS.GREEN, `✅ ${message}`);
}

function logError(message) {
  log(COLORS.RED, `❌ ${message}`);
}

function logWarning(message) {
  log(COLORS.YELLOW, `⚠️  ${message}`);
}

function logInfo(message) {
  log(COLORS.BLUE, `ℹ️  ${message}`);
}

function killProcesses() {
  return new Promise((resolve) => {
    logInfo('Cleaning up running processes...');
    
    const processesToKill = [
      'monitor.exe',
      'uDBM - Database Monitor.exe',
      'electron.exe'
    ];
    
    let killed = 0;
    let completed = 0;
    
    processesToKill.forEach(processName => {
      exec(`taskkill /f /im "${processName}" 2>nul`, (error, stdout, stderr) => {
        completed++;
        if (!error && stdout.includes('SUCCESS')) {
          killed++;
          logSuccess(`Terminated ${processName}`);
        }
        
        if (completed === processesToKill.length) {
          if (killed > 0) {
            logSuccess(`Cleaned up ${killed} running processes`);
            // Wait a bit for file handles to be released
            setTimeout(resolve, 2000);
          } else {
            logInfo('No processes needed cleanup');
            resolve();
          }
        }
      });
    });
  });
}

function cleanBuildDirectory() {
  return new Promise((resolve) => {
    logInfo('Cleaning build directory...');
    
    const buildDir = path.join(__dirname, '..', 'dist', 'electron-build');
    
    if (fs.existsSync(buildDir)) {
      // Try to remove the directory
      exec(`rmdir /s /q "${buildDir}" 2>nul`, (error) => {
        if (error) {
          logWarning('Could not fully clean build directory (some files may be locked)');
        } else {
          logSuccess('Build directory cleaned');
        }
        resolve();
      });
    } else {
      logInfo('Build directory does not exist');
      resolve();
    }
  });
}

function runElectronBuilder() {
  return new Promise((resolve, reject) => {
    logInfo('Starting electron-builder...');
    
    const child = spawn('npx', ['electron-builder'], {
      stdio: 'inherit',
      shell: true
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        logSuccess('Build completed successfully!');
        resolve();
      } else {
        logError(`Build failed with exit code ${code}`);
        reject(new Error(`Build failed with exit code ${code}`));
      }
    });
    
    child.on('error', (err) => {
      logError(`Build process error: ${err.message}`);
      reject(err);
    });
  });
}

async function main() {
  try {
    logInfo('Starting clean build process...');
    
    // Step 1: Kill any running processes
    await killProcesses();
    
    // Step 2: Clean build directory
    await cleanBuildDirectory();
    
    // Step 3: Run electron-builder
    await runElectronBuilder();
    
    logSuccess('Clean build completed successfully! 🎉');
    
  } catch (error) {
    logError('Build failed!');
    logError(error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
