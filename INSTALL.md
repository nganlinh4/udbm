# UDBM Installation Guide

This guide provides step-by-step instructions for installing and running the UDBM (Universal Database Monitor) application.

## Quick Start

### For Linux/macOS Users

1. **Run the automated installation script:**
   ```bash
   ./install.sh
   ```

2. **Start the application:**
   ```bash
   ./run.sh
   ```

3. **Open your browser and navigate to:**
   ```
   http://127.0.0.1:5046
   ```

### For Windows Users

1. **Run the automated installation script:**
   ```cmd
   install.bat
   ```

2. **Start the application:**
   ```cmd
   run.bat
   ```

3. **Open your browser and navigate to:**
   ```
   http://127.0.0.1:5046
   ```

## Manual Installation

If you prefer to install manually or the automated scripts don't work for your system:

### Prerequisites

- Python 3.8 or higher
- pip (Python package installer)
- Graphviz (for schema visualization)

### System Dependencies

#### Ubuntu/Debian:
```bash
sudo apt update
sudo apt install -y python3 python3-pip python3-venv python3-dev
sudo apt install -y graphviz graphviz-dev
sudo apt install -y build-essential libmysqlclient-dev libpq-dev
```

#### CentOS/RHEL:
```bash
sudo yum update -y
sudo yum install -y python3 python3-pip python3-devel
sudo yum install -y graphviz graphviz-devel
sudo yum install -y gcc gcc-c++ make mysql-devel postgresql-devel
```

#### Fedora:
```bash
sudo dnf update -y
sudo dnf install -y python3 python3-pip python3-devel
sudo dnf install -y graphviz graphviz-devel
sudo dnf install -y gcc gcc-c++ make mysql-devel postgresql-devel
```

#### macOS (with Homebrew):
```bash
brew install python3 graphviz mysql postgresql
```

#### Windows:
1. Install Python 3.8+ from [python.org](https://python.org)
2. Install Graphviz from [graphviz.org](https://graphviz.org/download/) or use:
   - Chocolatey: `choco install graphviz`
   - Winget: `winget install Graphviz.Graphviz`

### Python Environment Setup

1. **Create a virtual environment:**
   ```bash
   python3 -m venv venv
   ```

2. **Activate the virtual environment:**
   
   **Linux/macOS:**
   ```bash
   source venv/bin/activate
   ```
   
   **Windows:**
   ```cmd
   venv\Scripts\activate.bat
   ```

3. **Install Python dependencies:**
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

### Verify Installation

1. **Test Graphviz installation:**
   ```bash
   dot -V
   ```

2. **Test Python imports:**
   ```bash
   python -c "import flask, mysql.connector, psycopg2, graphviz, pandas, psutil; print('All dependencies imported successfully')"
   ```

## Running the Application

### Method 1: Using Run Scripts

**Linux/macOS:**
```bash
./run.sh
```

**Windows:**
```cmd
run.bat
```

### Method 2: Manual Start

1. **Activate virtual environment:**
   ```bash
   source venv/bin/activate  # Linux/macOS
   # or
   venv\Scripts\activate.bat  # Windows
   ```

2. **Start the application:**
   ```bash
   python monitor.py
   ```

3. **Access the application:**
   Open your browser and go to: `http://127.0.0.1:5046`

## Troubleshooting

### Common Issues

1. **Graphviz Error: "failed to execute PosixPath('dot')"**
   - **Solution:** Install Graphviz system package (see system dependencies above)
   - **Verify:** Run `dot -V` to confirm installation

2. **Port 5046 already in use**
   - **Solution:** Kill existing processes or change port in monitor.py
   - **Find process:** `lsof -i :5046` (Linux/macOS) or `netstat -ano | findstr :5046` (Windows)

3. **Python virtual environment creation fails**
   - **Ubuntu/Debian:** Install `python3-venv` package
   - **Solution:** `sudo apt install python3-venv`

4. **MySQL/PostgreSQL connection errors**
   - **Solution:** Install database client libraries (see system dependencies)
   - **Alternative:** Use SQLite for testing (no additional setup required)

5. **Permission denied on scripts**
   - **Solution:** Make scripts executable
   - **Command:** `chmod +x install.sh run.sh`

### Getting Help

If you encounter issues not covered here:

1. Check the application logs in the terminal
2. Verify all system dependencies are installed
3. Ensure Python virtual environment is activated
4. Check that all required ports are available

## Project Structure

```
udbm/
├── install.sh          # Linux/macOS installation script
├── install.bat         # Windows installation script
├── run.sh             # Linux/macOS run script
├── run.bat            # Windows run script
├── monitor.py         # Main application file
├── requirements.txt   # Python dependencies
├── config.py          # Configuration file
├── static/           # Static web assets
├── templates/        # HTML templates
└── venv/            # Python virtual environment (created during install)
```

## Features

- **Database Monitoring:** Real-time monitoring of MySQL and PostgreSQL databases
- **Schema Visualization:** Interactive database schema diagrams
- **Multi-language Support:** Interface available in multiple languages
- **Export Capabilities:** Export data to Excel, CSV formats
- **Responsive Design:** Works on desktop and mobile devices

## Next Steps

After successful installation:

1. Configure your database connections in the web interface
2. Explore the schema visualization features
3. Set up monitoring for your databases
4. Customize the interface language and theme preferences

For more detailed usage instructions, refer to the main README.md file.
