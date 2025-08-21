@echo off
REM UDBM Run Script for Windows
REM Simple script to start the UDBM monitor application

echo [INFO] Starting UDBM Monitor Application...

REM Check if virtual environment exists
if not exist "venv" (
    echo [ERROR] Virtual environment not found!
    echo Please run install.bat first to set up the environment
    pause
    exit /b 1
)

REM Check if monitor.py exists
if not exist "monitor.py" (
    echo [ERROR] monitor.py not found!
    echo Please run this script from the UDBM project root directory
    pause
    exit /b 1
)

REM Activate virtual environment and run the application
echo [SUCCESS] Virtual environment found
echo [INFO] Activating virtual environment...
call venv\Scripts\activate.bat

echo [INFO] Starting Flask application...
echo.
echo The application will be available at:
echo http://127.0.0.1:5080
echo.
echo Press Ctrl+C to stop the application
echo.

REM Run the monitor application
python monitor.py

pause
