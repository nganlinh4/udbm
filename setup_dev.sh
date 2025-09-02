#!/bin/bash

# uDBM Developer Setup Script
# This script sets up the development environment for uDBM Electron app

echo -e "\033[36m============================================\033[0m"
echo -e "\033[36m  uDBM Developer Environment Setup\033[0m"
echo -e "\033[36m============================================\033[0m"
echo ""

# Check Python installation
echo -e "\033[33mChecking Python installation...\033[0m"
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo -e "\033[32m✓ Python found: $PYTHON_VERSION\033[0m"
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_VERSION=$(python --version)
    echo -e "\033[32m✓ Python found: $PYTHON_VERSION\033[0m"
    PYTHON_CMD="python"
else
    echo -e "\033[31m✗ Python not found. Please install Python 3.8 or higher.\033[0m"
    exit 1
fi

# Check Node.js installation
echo -e "\033[33mChecking Node.js installation...\033[0m"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "\033[32m✓ Node.js found: $NODE_VERSION\033[0m"
else
    echo -e "\033[31m✗ Node.js not found. Please install Node.js 16 or higher.\033[0m"
    exit 1
fi

# Create Python virtual environment
echo -e "\n\033[33mSetting up Python virtual environment...\033[0m"
if [ -d "venv" ]; then
    echo -e "  Virtual environment already exists. Skipping creation."
else
    $PYTHON_CMD -m venv venv
    echo -e "\033[32m✓ Virtual environment created\033[0m"
fi

# Activate virtual environment and install Python dependencies
echo -e "\n\033[33mInstalling Python dependencies...\033[0m"
source venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
pip install pyinstaller

echo -e "\033[32m✓ Python dependencies installed\033[0m"

# Install Node.js dependencies
echo -e "\n\033[33mInstalling Node.js dependencies...\033[0m"
npm install
echo -e "\033[32m✓ Node.js dependencies installed\033[0m"

# Create config.py if it doesn't exist
if [ ! -f "backend/config.py" ]; then
    echo -e "\n\033[33mCreating config.py from template...\033[0m"
    if [ -f "backend/config_example.py" ]; then
        cp backend/config_example.py backend/config.py
        echo -e "\033[32m✓ config.py created. Please update it with your database credentials.\033[0m"
    else
        echo -e "  config_example.py not found. Skipping config.py creation."
    fi
fi

echo -e "\n\033[36m============================================\033[0m"
echo -e "\033[32m  Setup Complete!\033[0m"
echo -e "\033[36m============================================\033[0m"
echo ""
echo -e "\033[33mNext steps:\033[0m"
echo -e "  1. Update backend/config.py with your database credentials (if needed)"
echo -e "  2. Run 'npm run dev' to start in development mode"
echo -e "  3. Run 'npm run build' to create portable executable"
echo ""
echo -e "\033[36mThe portable executable will be created in the 'release' folder\033[0m"
