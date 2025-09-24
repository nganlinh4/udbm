# -*- mode: python ; coding: utf-8 -*-
import sys
import os
from pathlib import Path

# Get the backend directory path
backend_dir = os.path.abspath(os.path.join(SPECPATH, '..', 'backend'))
sys.path.insert(0, backend_dir)

block_cipher = None

a = Analysis(
    [os.path.join(backend_dir, 'monitor.py')],
    pathex=[backend_dir],
    binaries=[],
    datas=[
        (os.path.join(backend_dir, 'static'), 'static'),
        (os.path.join(backend_dir, 'templates'), 'templates'),
    ],
    hiddenimports=[
        'flask',
        'flask_cors',
        'mysql.connector',
        'psycopg2',
        'psycopg2.extras',
        'pandas',
        'pandas._libs',
        'pandas._libs.hashtable',
        'pandas._libs.tslibs',
        'pandas._libs.interval',
        'pytz',
        'dateutil',
        'jinja2.ext',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Test frameworks
        'pytest',
        'unittest',
        'doctest',
        # GUI libraries
        'tkinter',
        'PyQt5',
        'PyQt6',
        'PySide2',
        'PySide6',
        # Scientific/plotting
        'matplotlib',
        'scipy',
        'seaborn',
        'plotly',
        'bokeh',
        # ML/AI libraries
        'sklearn',
        'tensorflow',
        'torch',
        'keras',
        # Development tools
        'IPython',
        'jupyter',
        'notebook',
        'pip',
        'setuptools',
        'wheel',
        # Unused database drivers
        'pymongo',
        'redis',
        'sqlite3',
        'pymysql',
        'sqlalchemy',
        # Unused packages
        'graphviz',
        'faker',
        'psutil',
        'cryptography',
        # Data analysis packages we don't need
        'openpyxl',
        'xlsxwriter',
        'pyarrow',
        'lxml',
        'html5lib',
        'jdcal',
        'et_xmlfile',
        'odfpy',
        'pyxlsb',
        'xlrd',
        'xlwt',
        # Numpy/pandas related
        'numpy.testing',
        'numpy.distutils',
        # 'pandas.plotting',  # Required internally by pandas
        'pandas.io.clipboard',
        'pandas.io.formats.style',
        # Other unused
        'PIL',
        'pillow',
        'win32com',
        'pythoncom',
        'pywintypes',
        # Note: pytz and dateutil are required by pandas, don't exclude them
        # 'pytz',
        # 'dateutil',
        # 'six',  # Required by dateutil
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='monitor',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,  # Keep console for debugging Python backend
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='monitor',
)
