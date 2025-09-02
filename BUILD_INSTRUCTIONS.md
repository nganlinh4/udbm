# Build Instructions for uDBM Electron App

## Prerequisites

### Required Software
- **Python 3.8+** - [Download](https://www.python.org/downloads/)
- **Node.js 16+** - [Download](https://nodejs.org/)
- **Git** - [Download](https://git-scm.com/)

### System Requirements
- Windows 10/11 (64-bit) for Windows builds
- macOS 10.14+ for macOS builds
- Ubuntu 18.04+ or similar for Linux builds

## Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/nganlinh4/udbm.git
cd udbm
```

### 2. Run Automated Setup

**Windows (PowerShell):**
```powershell
# May need to allow script execution first:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Run setup script
.\setup_dev.ps1
```

**Linux/macOS:**
```bash
chmod +x setup_dev.sh
./setup_dev.sh
```

### 3. Manual Setup (Alternative)

If the automated scripts don't work, you can set up manually:

```bash
# Create Python virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install Python dependencies
pip install --upgrade pip
pip install -r backend/requirements.txt
pip install pyinstaller

# Install Node dependencies
npm install
```

## Running in Development Mode

```bash
# Start both Flask backend and Electron frontend
npm run dev

# Or run separately:
# Terminal 1 - Start Flask backend
cd backend
python monitor.py

# Terminal 2 - Start Electron frontend
npm run edev
```

## Building the Application

### Building for Current Platform

```bash
# Build complete application (Python + Electron)
npm run build

# The portable executable will be in: release/
```

### Building Components Separately

```bash
# Build Python backend only
npm run pybuild
# Output: backend/dist/monitor/

# Build Electron app only (requires Python backend built first)
npm run electron:build
# Output: release/
```

## Build Output

### Windows
- **File**: `release/uDBM-1.0.0-portable.exe`
- **Type**: Portable executable (no installation required)
- **Size**: ~150-200 MB (includes Python runtime)

### macOS (Future)
- **File**: `release/uDBM-1.0.0.dmg`
- **Type**: Disk image with app bundle

### Linux (Future)
- **File**: `release/uDBM-1.0.0.AppImage`
- **Type**: AppImage (portable)

## Troubleshooting

### Common Issues

#### 1. PyInstaller not found
```bash
pip install pyinstaller
```

#### 2. Node modules issues
```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### 3. Python backend won't build
- Ensure all Python dependencies are installed
- Check that virtual environment is activated
- Verify PyInstaller spec file path is correct

#### 4. Port 5080 already in use
- Check if another instance is running
- Change port in `backend/monitor.py` if needed

#### 5. Database connection issues in built app
- Ensure database drivers are included in PyInstaller spec
- Check firewall settings
- Verify database credentials

### Build Logs

Build logs can be found in:
- Python build: `backend/build/monitor/`
- Electron build: Check console output

## CI/CD

GitHub Actions automatically builds the application on:
- Push to main/master/develop branches
- Pull requests to main/master
- Tag pushes (v*)

Artifacts are uploaded to GitHub Actions and releases.

## Advanced Configuration

### Customizing PyInstaller Build

Edit `build-tools/monitor.spec`:
- Add hidden imports for missing modules
- Include additional data files
- Modify executable properties

### Customizing Electron Build

Edit `package.json` build configuration:
- Change app ID, product name
- Modify build targets
- Add code signing (requires certificates)

### Environment Variables

Create `.env` file for environment-specific settings:
```
FLASK_ENV=production
FLASK_DEBUG=0
DATABASE_URL=mysql://user:pass@localhost/db
```

## Distribution

### Creating a Release

1. Update version in `package.json`
2. Commit changes
3. Create and push a tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
4. GitHub Actions will build and create a release

### Manual Distribution

After building:
1. Test the executable on a clean system
2. Compress if needed (already portable)
3. Upload to distribution platform
4. Include database setup instructions

## Security Considerations

- Never commit `backend/config.py` with real credentials
- Use environment variables for sensitive data
- Code sign executables for production distribution
- Keep dependencies updated

## Support

For issues or questions:
- Open an issue on [GitHub](https://github.com/nganlinh4/udbm/issues)
- Check existing issues for solutions
- Include build logs when reporting problems
