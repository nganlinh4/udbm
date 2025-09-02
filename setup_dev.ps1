# uDBM Developer Setup Script
# This script sets up the development environment for uDBM Electron app

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  uDBM Developer Environment Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check Python installation
Write-Host "Checking Python installation..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✓ Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Python not found. Please install Python 3.8 or higher." -ForegroundColor Red
    exit 1
}

# Check Node.js installation
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found. Please install Node.js 16 or higher." -ForegroundColor Red
    exit 1
}

# Create Python virtual environment
Write-Host "`nSetting up Python virtual environment..." -ForegroundColor Yellow
if (Test-Path "venv") {
    Write-Host "  Virtual environment already exists. Skipping creation." -ForegroundColor Gray
} else {
    python -m venv venv
    Write-Host "✓ Virtual environment created" -ForegroundColor Green
}

# Activate virtual environment and install Python dependencies
Write-Host "`nInstalling Python dependencies..." -ForegroundColor Yellow
& "venv\Scripts\Activate.ps1"
pip install --upgrade pip
pip install -r backend\requirements.txt
pip install pyinstaller

Write-Host "✓ Python dependencies installed" -ForegroundColor Green

# Install Node.js dependencies
Write-Host "`nInstalling Node.js dependencies..." -ForegroundColor Yellow
npm install
Write-Host "✓ Node.js dependencies installed" -ForegroundColor Green

# Create config.py if it doesn't exist
if (-not (Test-Path "backend\config.py")) {
    Write-Host "`nCreating config.py from template..." -ForegroundColor Yellow
    if (Test-Path "backend\config_example.py") {
        Copy-Item "backend\config_example.py" "backend\config.py"
        Write-Host "✓ config.py created. Please update it with your database credentials." -ForegroundColor Green
    } else {
        Write-Host "  config_example.py not found. Skipping config.py creation." -ForegroundColor Gray
    }
}

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Update backend\config.py with your database credentials (if needed)" -ForegroundColor White
Write-Host "  2. Run 'npm run dev' to start in development mode" -ForegroundColor White
Write-Host "  3. Run 'npm run build' to create portable executable" -ForegroundColor White
Write-Host ""
Write-Host "The portable .exe will be created in the 'release' folder" -ForegroundColor Cyan
