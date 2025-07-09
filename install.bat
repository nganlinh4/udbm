@echo off
REM UDBM Installation Script for Windows
REM This script automates the installation of all dependencies and setup for the UDBM project

setlocal enabledelayedexpansion

echo ========================================
echo     UDBM Installation Script (Windows)
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://python.org
    echo Make sure to check "Add Python to PATH" during installation
    pause
    exit /b 1
)

echo [INFO] Python found: 
python --version

REM Check if we're in the right directory
if not exist "monitor.py" (
    echo [ERROR] monitor.py not found
    echo Please run this script from the UDBM project root directory
    pause
    exit /b 1
)

if not exist "requirements.txt" (
    echo [ERROR] requirements.txt not found
    echo Please run this script from the UDBM project root directory
    pause
    exit /b 1
)

REM Check for Graphviz
echo [INFO] Checking for Graphviz...
dot -V >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Graphviz not found in PATH
    echo.
    echo Please install Graphviz manually:
    echo 1. Download from: https://graphviz.org/download/
    echo 2. Install and add to PATH
    echo 3. Or use chocolatey: choco install graphviz
    echo 4. Or use winget: winget install Graphviz.Graphviz
    echo.
    set /p continue="Continue without Graphviz? (y/N): "
    if /i not "!continue!"=="y" (
        echo Installation cancelled
        pause
        exit /b 1
    )
) else (
    echo [SUCCESS] Graphviz found
    dot -V
)

REM Remove existing virtual environment if it exists
if exist "venv" (
    echo [WARNING] Virtual environment already exists. Removing old one...
    rmdir /s /q venv
)

REM Create virtual environment
echo [INFO] Creating Python virtual environment...
python -m venv venv
if errorlevel 1 (
    echo [ERROR] Failed to create virtual environment
    pause
    exit /b 1
)

echo [SUCCESS] Virtual environment created

REM Activate virtual environment and install dependencies
echo [INFO] Installing Python dependencies...
call venv\Scripts\activate.bat

REM Upgrade pip
python -m pip install --upgrade pip

REM Install requirements
pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to install Python dependencies
    pause
    exit /b 1
)

echo [SUCCESS] Python dependencies installed

REM Create necessary directories
echo [INFO] Setting up project directories...
if not exist "static\css" mkdir static\css
if not exist "static\js" mkdir static\js
if not exist "static\locales" mkdir static\locales
if not exist "templates\components" mkdir templates\components

echo [SUCCESS] Project directories created

REM Test installation
echo [INFO] Testing installation...
python -c "import flask; import mysql.connector; import psycopg2; import graphviz; import pandas; import psutil; print('All Python dependencies imported successfully')"
if errorlevel 1 (
    echo [WARNING] Some dependencies may not be working correctly
) else (
    echo [SUCCESS] Installation test passed
)

echo.
echo ========================================
echo [SUCCESS] Installation completed!
echo ========================================
echo.
echo To run the application:
echo 1. Open Command Prompt or PowerShell
echo 2. Navigate to this directory
echo 3. Activate the virtual environment:
echo    venv\Scripts\activate.bat
echo 4. Run the monitor application:
echo    python monitor.py
echo 5. Open your browser and go to:
echo    http://127.0.0.1:5046
echo.
echo To deactivate the virtual environment later:
echo    deactivate
echo.

pause
