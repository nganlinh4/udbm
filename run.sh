#!/bin/bash

# UDBM Run Script
# Simple script to start the UDBM monitor application

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    print_error "Virtual environment not found!"
    print_error "Please run ./install.sh first to set up the environment"
    exit 1
fi

# Check if monitor.py exists
if [ ! -f "monitor.py" ]; then
    print_error "monitor.py not found!"
    print_error "Please run this script from the UDBM project root directory"
    exit 1
fi

print_status "Starting UDBM Monitor Application..."

# Activate virtual environment and run the application
source venv/bin/activate

print_success "Virtual environment activated"
print_status "Starting Flask application..."

# Run the monitor application
python monitor.py
