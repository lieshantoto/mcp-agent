#!/bin/bash

# MCP Agent - Automated Installation Script
# ==========================================
# This script sets up all dependencies for the MCP Agent automation framework

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Get OS type
get_os() {
    case "$(uname -s)" in
        Darwin*)    echo "macos";;
        Linux*)     echo "linux";;
        CYGWIN*|MINGW*|MSYS*) echo "windows";;
        *)          echo "unknown";;
    esac
}

# Check system requirements
check_system_requirements() {
    log_info "Checking system requirements..."
    
    local os=$(get_os)
    log_info "Operating System: $os"
    
    # Check if we're on a supported OS
    if [[ "$os" == "unknown" ]]; then
        log_error "Unsupported operating system"
        exit 1
    fi
    
    # Check for basic tools
    if ! command_exists "curl"; then
        log_error "curl is required but not installed"
        exit 1
    fi
    
    log_success "System requirements check passed"
}

# Install Node.js via nvm
install_nodejs() {
    log_info "Checking Node.js installation..."
    
    if command_exists "node"; then
        local node_version=$(node --version)
        log_info "Node.js already installed: $node_version"
        
        # Check if version is >= 16
        local major_version=$(echo $node_version | cut -d'.' -f1 | sed 's/v//')
        if [[ $major_version -ge 16 ]]; then
            log_success "Node.js version is compatible"
            return 0
        else
            log_warning "Node.js version is too old, installing newer version..."
        fi
    fi
    
    # Install nvm if not present
    if ! command_exists "nvm"; then
        log_info "Installing nvm (Node Version Manager)..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
        
        # Source nvm
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
    fi
    
    # Install Node.js 18.20.8 (recommended version)
    log_info "Installing Node.js v18.20.8..."
    nvm install 18.20.8
    nvm use 18.20.8
    nvm alias default 18.20.8
    
    log_success "Node.js installation completed"
}

# Install Python dependencies
install_python_deps() {
    log_info "Checking Python installation..."
    
    if ! command_exists "python3"; then
        log_error "Python 3 is required but not installed"
        log_info "Please install Python 3.8+ and run this script again"
        exit 1
    fi
    
    local python_version=$(python3 --version | cut -d' ' -f2)
    log_info "Python version: $python_version"
    
    # Create virtual environment if it doesn't exist
    if [[ ! -d "venv" ]]; then
        log_info "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    log_info "Activating virtual environment..."
    source venv/bin/activate
    
    # Create requirements.txt if it doesn't exist
    if [[ ! -f "requirements.txt" ]]; then
        log_info "Creating requirements.txt..."
        cat > requirements.txt << EOF
# Google ADK for multi-agent system
google-adk>=1.0.0

# Data processing and analysis
pandas>=1.3.0
numpy>=1.21.0

# HTTP requests and API testing
requests>=2.25.0
aiohttp>=3.8.0

# Configuration and environment
python-dotenv>=0.19.0
pyyaml>=6.0

# Testing frameworks
pytest>=7.0.0
pytest-asyncio>=0.21.0
pytest-html>=3.1.0

# Logging and debugging
colorlog>=6.7.0
rich>=12.0.0

# Optional: Jupyter for analysis
jupyter>=1.0.0
EOF
    fi
    
    # Install Python dependencies
    log_info "Installing Python dependencies..."
    pip install --upgrade pip
    pip install -r requirements.txt
    
    log_success "Python dependencies installed"
}

# Install Node.js dependencies
install_nodejs_deps() {
    log_info "Installing Node.js dependencies for MCP servers..."
    
    cd mcp-servers
    
    # Install dependencies
    npm install
    
    # Install global Appium if not present
    if ! command_exists "appium"; then
        log_info "Installing Appium globally..."
        npm install -g appium
        
        # Install Appium drivers
        log_info "Installing Appium drivers..."
        appium driver install uiautomator2  # Android
        
        # Install iOS driver only on macOS
        if [[ "$(get_os)" == "macos" ]]; then
            appium driver install xcuitest
        fi
    else
        log_info "Appium already installed: $(appium --version)"
    fi
    
    cd ..
    log_success "Node.js dependencies installed"
}

# Setup mobile testing environment
setup_mobile_environment() {
    log_info "Setting up mobile testing environment..."
    
    local os=$(get_os)
    
    if [[ "$os" == "macos" ]]; then
        # Check for Xcode on macOS
        if command_exists "xcodebuild"; then
            log_success "Xcode found - iOS testing enabled"
        else
            log_warning "Xcode not found - iOS testing will not be available"
            log_info "Install Xcode from the App Store to enable iOS testing"
        fi
    fi
    
    # Check for Android SDK
    if [[ -n "$ANDROID_HOME" ]] || [[ -n "$ANDROID_SDK_ROOT" ]]; then
        log_success "Android SDK found - Android testing enabled"
    else
        log_warning "Android SDK not found - Android testing may not work"
        log_info "Install Android Studio or SDK tools and set ANDROID_HOME environment variable"
    fi
}

# Create configuration files
create_config_files() {
    log_info "Creating configuration files..."
    
    # Create .env file if it doesn't exist
    if [[ ! -f ".env" ]]; then
        log_info "Creating .env configuration file..."
        cat > .env << EOF
# Appium Configuration
APPIUM_HOST=localhost
APPIUM_PORT=4723

# Device Configuration
ANDROID_DEVICE_NAME=Android Device
IOS_DEVICE_NAME=iPhone
ANDROID_PLATFORM_VERSION=11
IOS_PLATFORM_VERSION=15.0

# Test Configuration
TEST_TIMEOUT=30000
SCREENSHOT_PATH=./automation-state-captures

# Debug Configuration
DEBUG=false
LOG_LEVEL=info

# Node.js path (update if different)
NODE_PATH=/Users/\$USER/.nvm/versions/node/v18.20.8/bin/node
EOF
        log_success ".env file created"
    else
        log_info ".env file already exists"
    fi
    
    # Create automation-state-captures directory
    if [[ ! -d "automation-state-captures" ]]; then
        mkdir -p automation-state-captures
        log_success "Created automation-state-captures directory"
    fi
    
    # Create docs directory
    if [[ ! -d "docs" ]]; then
        mkdir -p docs
        log_success "Created docs directory"
    fi
}

# Verify installation
verify_installation() {
    log_info "Verifying installation..."
    
    local errors=0
    
    # Check Node.js
    if command_exists "node"; then
        local node_version=$(node --version)
        log_success "Node.js: $node_version"
    else
        log_error "Node.js not found"
        ((errors++))
    fi
    
    # Check npm
    if command_exists "npm"; then
        local npm_version=$(npm --version)
        log_success "npm: $npm_version"
    else
        log_error "npm not found"
        ((errors++))
    fi
    
    # Check Appium
    if command_exists "appium"; then
        local appium_version=$(appium --version)
        log_success "Appium: $appium_version"
    else
        log_error "Appium not found"
        ((errors++))
    fi
    
    # Check Python
    if command_exists "python3"; then
        local python_version=$(python3 --version)
        log_success "Python: $python_version"
    else
        log_error "Python 3 not found"
        ((errors++))
    fi
    
    # Test MCP server
    log_info "Testing MCP Appium server..."
    cd mcp-servers
    if timeout 10s bash -c 'echo "{\"jsonrpc\": \"2.0\", \"id\": 1, \"method\": \"tools/list\"}" | node mcp-appium-server-new.js' >/dev/null 2>&1; then
        log_success "MCP Appium server test passed"
    else
        log_warning "MCP Appium server test failed (this may be normal)"
    fi
    cd ..
    
    if [[ $errors -eq 0 ]]; then
        log_success "Installation verification completed successfully!"
    else
        log_warning "Installation completed with $errors errors"
    fi
}

# Print usage instructions
print_usage_instructions() {
    log_info "Installation completed! Here's how to get started:"
    echo ""
    echo -e "${GREEN}1. Start MCP Servers:${NC}"
    echo "   cd mcp-servers"
    echo "   npm run start:appium      # Mobile automation"
    echo "   npm run start:filesystem  # File operations"
    echo "   npm run start:test        # Test execution"
    echo ""
    echo -e "${GREEN}2. Start Appium Server (in separate terminal):${NC}"
    echo "   appium --allow-cors"
    echo ""
    echo -e "${GREEN}3. Configure your MCP client (e.g., VS Code):${NC}"
    echo "   Update .vscode/mcp.json with server paths"
    echo ""
    echo -e "${GREEN}4. Run Multi-Agent System:${NC}"
    echo "   source venv/bin/activate"
    echo "   cd multi_tool_agent"
    echo "   python agent.py"
    echo ""
    echo -e "${GREEN}5. Configure devices:${NC}"
    echo "   - Edit .env file with your device details"
    echo "   - Connect Android device or start emulator"
    echo "   - Connect iOS device (macOS only)"
    echo ""
    echo -e "${YELLOW}For detailed documentation, see README.md${NC}"
}

# Main installation function
main() {
    echo -e "${BLUE}"
    echo "========================================"
    echo "   MCP Agent Installation Script"
    echo "========================================"
    echo -e "${NC}"
    
    check_system_requirements
    install_nodejs
    install_python_deps
    install_nodejs_deps
    setup_mobile_environment
    create_config_files
    verify_installation
    
    echo ""
    log_success "Installation completed successfully!"
    echo ""
    print_usage_instructions
}

# Run main function
main "$@"
