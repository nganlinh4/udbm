'use strict';

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Resolve project root (this file is in scripts/)
const root = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';

// Candidate Python executables inside the root venv
const candidates = isWindows
  ? [
      path.join(root, 'venv', 'Scripts', 'python.exe'),
      path.join(root, 'venv', 'Scripts', 'python.bat')
    ]
  : [
      path.join(root, 'venv', 'bin', 'python3'),
      path.join(root, 'venv', 'bin', 'python')
    ];

const pythonPath = candidates.find(p => fs.existsSync(p));

if (!pythonPath) {
  console.error('[pydev] Could not find Python in root venv.');
  console.error('[pydev] Expected one of:');
  for (const c of candidates) console.error('  - ' + c);
  console.error('[pydev] Please create the venv at the project root, e.g.:');
  console.error('       python -m venv venv');
  process.exit(1);
}

const backendDir = path.join(root, 'backend');
const script = 'monitor.py';

console.log('[pydev] Using Python from venv:', pythonPath);
console.log('[pydev] Working directory:', backendDir);

const child = spawn(pythonPath, [script], {
  cwd: backendDir,
  stdio: 'inherit',
  windowsHide: false,
  env: process.env,
});

child.on('close', (code, signal) => {
  if (signal) {
    console.error(`[pydev] Backend terminated by signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});

