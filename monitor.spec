# -*- mode: python ; coding: utf-8 -*-

import os
import sys
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

# Get the current directory
current_dir = os.path.dirname(os.path.abspath(SPEC))

# Collect data files for templates and static assets
template_files = []
static_files = []

# Add template files
for root, dirs, files in os.walk(os.path.join(current_dir, 'templates')):
    for file in files:
        if file.endswith(('.html', '.css', '.js')):
            src = os.path.join(root, file)
            dst = os.path.relpath(src, current_dir)
            template_files.append((src, os.path.dirname(dst)))

# Add static files
for root, dirs, files in os.walk(os.path.join(current_dir, 'static')):
    for file in files:
        src = os.path.join(root, file)
        dst = os.path.relpath(src, current_dir)
        static_files.append((src, os.path.dirname(dst)))

# Collect hidden imports for database connectors and other dependencies
hidden_imports = [
    'mysql.connector',
    'mysql.connector.cursor',
    'mysql.connector.pooling',
    'psycopg2',
    'psycopg2.extras',
    'psycopg2._psycopg',
    'graphviz',
    'pandas',
    'numpy',
    'openpyxl',
    'xlsxwriter',
    'faker',
    'pymysql',
    'cryptography',
    'flask',
    'flask_cors',
    'sqlalchemy',
    'psutil',
    'decimal',
    'datetime',
    'json',
    'csv',
    'io',
    'urllib.parse',
    'logging'
]

# Collect data files for packages that need them
datas = template_files + static_files

# Add GraphViz binaries
graphviz_bin_path = r'C:\Program Files\Graphviz\bin'
if os.path.exists(graphviz_bin_path):
    for file in os.listdir(graphviz_bin_path):
        if file.endswith(('.exe', '.dll')):
            src = os.path.join(graphviz_bin_path, file)
            datas.append((src, 'graphviz/bin'))

# Add any additional data files from packages
try:
    datas += collect_data_files('graphviz')
except:
    pass

a = Analysis(
    ['monitor.py'],
    pathex=[current_dir],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'scipy',
        'PIL',
        'PyQt5',
        'PyQt6',
        'PySide2',
        'PySide6'
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='monitor',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # Set to False for windowed app
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
