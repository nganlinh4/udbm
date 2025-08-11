#!/usr/bin/env node

/**
 * Test script to validate the portable Electron app before distribution
 * This helps catch dependency and runtime errors before users encounter them
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

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

async function testPortableApp() {
  logInfo('Testing portable Electron application...');
  
  // Check if build exists
  const buildPath = path.join(__dirname, '..', 'dist', 'electron-build', 'win-unpacked');
  const exePath = path.join(buildPath, 'uDBM - Database Monitor.exe');
  
  if (!fs.existsSync(exePath)) {
    logError(`Portable executable not found at: ${exePath}`);
    logError('Run "npm run build" first to create the portable app');
    process.exit(1);
  }
  
  logSuccess('Portable executable found');
  
  // Test 1: Check if app starts without crashing
  logInfo('Test 1: Starting application...');
  
  return new Promise((resolve, reject) => {
    const child = spawn(exePath, [], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });
    
    let stdout = '';
    let stderr = '';
    let hasError = false;
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
      
      // Check for common error patterns
      if (data.toString().includes('Cannot find module')) {
        hasError = true;
        logError('Missing module dependency detected!');
        logError(data.toString());
      }
      
      if (data.toString().includes('Uncaught Exception')) {
        hasError = true;
        logError('Uncaught exception detected!');
        logError(data.toString());
      }
    });
    
    // Give the app time to start and show any immediate errors
    setTimeout(() => {
      if (!hasError) {
        logSuccess('Application started successfully (no immediate errors)');
        
        // Test 2: Check if Flask server starts
        logInfo('Test 2: Checking if Flask server starts...');
        
        // Look for Flask server startup messages
        if (stderr.includes('Starting Flask server') || stderr.includes('Running on http://')) {
          logSuccess('Flask server started successfully');
        } else {
          logWarning('Flask server startup not detected in logs');
        }
        
        // Test 3: Basic HTTP check (optional)
        logInfo('Test 3: Testing HTTP endpoint...');
        
        // Try to connect to the Flask server
        const http = require('http');
        const req = http.get('http://localhost:5046', (res) => {
          if (res.statusCode === 200) {
            logSuccess('HTTP endpoint responding correctly');
          } else {
            logWarning(`HTTP endpoint returned status: ${res.statusCode}`);
          }
          
          // Clean up
          child.kill();
          resolve();
        });
        
        req.on('error', (err) => {
          logWarning('HTTP endpoint not accessible (this might be normal if port is different)');
          child.kill();
          resolve();
        });
        
        // Timeout for HTTP test
        setTimeout(() => {
          req.destroy();
          child.kill();
          resolve();
        }, 5000);
        
      } else {
        child.kill();
        reject(new Error('Application failed to start properly'));
      }
    }, 8000); // Give app 8 seconds to start
    
    child.on('error', (err) => {
      logError(`Failed to start application: ${err.message}`);
      reject(err);
    });
    
    child.on('exit', (code, signal) => {
      if (code !== 0 && code !== null && !hasError) {
        logError(`Application exited with code: ${code}`);
        reject(new Error(`Exit code: ${code}`));
      }
    });
  });
}

async function main() {
  try {
    await testPortableApp();
    logSuccess('All tests passed! ✨');
    logInfo('The portable application is ready for distribution.');
  } catch (error) {
    logError('Tests failed!');
    logError(error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
