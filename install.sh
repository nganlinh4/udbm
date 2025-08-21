#!/bin/bash

# UDBM Installation Script
# This script automates the installation of all dependencies and setup for the UDBM project

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to detect OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command_exists apt-get; then
            echo "ubuntu"
        elif command_exists yum; then
            echo "centos"
        elif command_exists dnf; then
            echo "fedora"
        else
            echo "linux"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    else
        echo "unknown"
    fi
}

# Function to install system dependencies
install_system_deps() {
    local os=$(detect_os)
    print_status "Detected OS: $os"
    
    case $os in
        "ubuntu")
            print_status "Installing system dependencies for Ubuntu/Debian..."
            sudo apt update
            sudo apt install -y python3 python3-pip python3-venv python3-dev
            sudo apt install -y graphviz graphviz-dev
            sudo apt install -y build-essential
            # Optional: MySQL and PostgreSQL client libraries
            sudo apt install -y libmysqlclient-dev libpq-dev
            ;;
        "centos")
            print_status "Installing system dependencies for CentOS..."
            sudo yum update -y
            sudo yum install -y python3 python3-pip python3-devel
            sudo yum install -y graphviz graphviz-devel
            sudo yum install -y gcc gcc-c++ make
            sudo yum install -y mysql-devel postgresql-devel
            ;;
        "fedora")
            print_status "Installing system dependencies for Fedora..."
            sudo dnf update -y
            sudo dnf install -y python3 python3-pip python3-devel
            sudo dnf install -y graphviz graphviz-devel
            sudo dnf install -y gcc gcc-c++ make
            sudo dnf install -y mysql-devel postgresql-devel
            ;;
        "macos")
            print_status "Installing system dependencies for macOS..."
            if command_exists brew; then
                brew install python3 graphviz
                brew install mysql postgresql
            else
                print_error "Homebrew not found. Please install Homebrew first: https://brew.sh/"
                exit 1
            fi
            ;;
        *)
            print_warning "Unknown OS. Please install the following manually:"
            print_warning "- Python 3.8+"
            print_warning "- pip"
            print_warning "- Graphviz"
            print_warning "- Development tools (gcc, make)"
            ;;
    esac
}

# Function to create virtual environment
setup_venv() {
    print_status "Setting up Python virtual environment..."
    
    if [ -d "venv" ]; then
        print_warning "Virtual environment already exists. Removing old one..."
        rm -rf venv
    fi
    
    python3 -m venv venv
    print_success "Virtual environment created"
}

# Function to install Python dependencies
install_python_deps() {
    print_status "Installing Python dependencies..."
    
    source venv/bin/activate
    
    # Upgrade pip
    pip install --upgrade pip
    
    # Install requirements
    if [ -f "requirements.txt" ]; then
        pip install -r requirements.txt
        print_success "Python dependencies installed"
    else
        print_error "requirements.txt not found!"
        exit 1
    fi
}

# Function to verify Graphviz installation
verify_graphviz() {
    print_status "Verifying Graphviz installation..."
    
    if command_exists dot; then
        print_success "Graphviz 'dot' command found: $(which dot)"
        dot -V
    else
        print_error "Graphviz 'dot' command not found in PATH"
        print_error "Please ensure Graphviz is properly installed"
        exit 1
    fi
}

# Function to create necessary directories
setup_directories() {
    print_status "Setting up project directories..."
    
    mkdir -p static/css
    mkdir -p static/js
    mkdir -p static/locales
    mkdir -p templates/components
    
    print_success "Project directories created"
}

# Function to test the installation
test_installation() {
    print_status "Testing installation..."
    
    source venv/bin/activate
    
    # Test Python imports
    python3 -c "
import flask
import mysql.connector
import psycopg2
import graphviz
import pandas
import psutil
print('All Python dependencies imported successfully')
"
    
    print_success "Installation test passed"
}

# Function to display usage instructions
show_usage() {
    echo ""
    print_success "Installation completed successfully!"
    echo ""
    echo "To run the application:"
    echo "1. Activate the virtual environment:"
    echo "   source venv/bin/activate"
    echo ""
    echo "2. Run the monitor application:"
    echo "   python monitor.py"
    echo ""
    echo "3. Open your browser and go to:"
    echo "   http://127.0.0.1:5080"
    echo ""
    echo "To deactivate the virtual environment later:"
    echo "   deactivate"
    echo ""
}

# Main installation function
main() {
    echo "========================================"
    echo "    UDBM Installation Script"
    echo "========================================"
    echo ""
    
    # Check if running as root
    if [[ $EUID -eq 0 ]]; then
        print_warning "Running as root. This is not recommended."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    # Check if we're in the right directory
    if [ ! -f "monitor.py" ] || [ ! -f "requirements.txt" ]; then
        print_error "Please run this script from the UDBM project root directory"
        exit 1
    fi
    
    print_status "Starting installation process..."
    
    # Install system dependencies
    install_system_deps
    
    # Verify Graphviz
    verify_graphviz
    
    # Setup virtual environment
    setup_venv
    
    # Install Python dependencies
    install_python_deps
    
    # Setup directories
    setup_directories
    
    # Test installation
    test_installation
    
    # Show usage instructions
    show_usage
}

# Run main function
main "$@"
