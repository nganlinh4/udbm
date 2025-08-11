#!/usr/bin/env node

/**
 * Manual cleanup script for when builds get stuck
 * Run this if you encounter file locking issues
 */

const { exec } = require('child_process');

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

function logInfo(message) {
  log(COLORS.BLUE, `ℹ️  ${message}`);
}

async function cleanup() {
  logInfo('Running manual cleanup...');
  
  const processesToKill = [
    'monitor.exe',
    'uDBM - Database Monitor.exe',
    'electron.exe',
    'python.exe'
  ];
  
  for (const processName of processesToKill) {
    await new Promise((resolve) => {
      exec(`taskkill /f /im "${processName}" 2>nul`, (error, stdout) => {
        if (!error && stdout.includes('SUCCESS')) {
          logSuccess(`Terminated ${processName}`);
        }
        resolve();
      });
    });
  }
  
  logSuccess('Cleanup completed! You can now run npm run build');
}

cleanup();
