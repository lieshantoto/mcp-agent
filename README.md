# MCP Agent - Mobile & Web Automation Framework

A comprehensive automation framework built with Model Context Protocol (MCP) servers for mobile and web application testing. This repository provides a complete toolkit for automated testing across iOS, Android, and web platforms.

## 🚀 Features

### Core Capabilities
- **Cross-Platform Mobile Automation**: iOS and Android support via Appium WebDriver
- **Web Browser Automation**: Playwright integration for web testing
- **Multi-Agent System**: Google ADK-powered agent coordination
- **State Capture & Analysis**: Automatic screenshot and page source capture
- **Smart Element Detection**: AI-powered fallback mechanisms for element interaction
- **Test Management**: Comprehensive test execution and reporting

### MCP Servers
- **Appium Server**: Mobile device interaction and automation
- **Filesystem Server**: File operations and project management
- **Code Analysis Server**: Static code analysis and quality checks
- **Code Modification Server**: Automated code generation and modification
- **Test Execution Server**: Test runner with comprehensive reporting
- **Advanced Tools Server**: Extended automation capabilities

### Testing Framework
- **Feature-Based Structure**: Organized by business domains
- **Page Object Model**: Maintainable and reusable test components
- **API Testing**: Backend service validation
- **Performance Testing**: Load and performance metrics
- **Cross-Browser Testing**: Multi-browser compatibility validation

## 📋 Prerequisites

### System Requirements
- **Node.js**: >= 16.0.0 (recommended: v18.20.8 via nvm)
- **Python**: >= 3.8 (for multi-agent system)
- **Java**: >= 8 (for Appium)
- **Android SDK**: For Android testing
- **Xcode**: For iOS testing (macOS only)

### Mobile Testing Prerequisites
- **Appium Server**: Will be installed automatically
- **iOS**: Xcode with Command Line Tools
- **Android**: Android Studio or SDK tools
- **Device/Emulator**: Physical devices or simulators

## 🛠️ Installation

### Quick Setup
Run the automated installer to set up all dependencies:

```bash
# Clone the repository
git clone <repository-url>
cd mcp-agent

# Run the automated installer
chmod +x install.sh
./install.sh
```

### Manual Installation

#### 1. Node.js Dependencies
```bash
# Install MCP server dependencies
cd mcp-servers
npm install

# Return to root directory
cd ..
```

#### 2. Python Dependencies
```bash
# Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt
```

#### 3. Mobile Testing Setup
```bash
# Install Appium globally
npm install -g appium

# Install Appium drivers
appium driver install uiautomator2  # Android
appium driver install xcuitest      # iOS (macOS only)

# Start Appium server (in separate terminal)
appium --allow-cors
```

## 🎯 Quick Start

### 1. Start MCP Servers
```bash
# Start individual servers
cd mcp-servers
npm run start:appium      # Mobile automation
npm run start:filesystem  # File operations
npm run start:test        # Test execution

# Or start multiple servers as needed
```

### 2. Configure MCP Client
Add to your MCP client configuration (e.g., `.vscode/mcp.json`):

```json
{
  "mcpServers": {
    "appium-automation": {
      "command": "/path/to/node",
      "args": ["/path/to/mcp-agent/mcp-servers/mcp-appium-server-new.js"],
      "cwd": "/path/to/mcp-agent"
    },
    "filesystem": {
      "command": "/path/to/node",
      "args": ["/path/to/mcp-agent/mcp-servers/mcp-filesystem-server.js"],
      "cwd": "/path/to/mcp-agent"
    }
  }
}
```

### 3. Mobile Device Testing
```bash
# Connect to Android device
# Use MCP client to call: appium_connect with platform: "Android"

# Connect to iOS device  
# Use MCP client to call: appium_connect with platform: "iOS"

# Take screenshot
# Use MCP client to call: get_screenshot

# Find and click element
# Use MCP client to call: smart_find_and_click
```

### 4. Multi-Agent System
```python
# Run the multi-agent system
cd multi_tool_agent
python agent.py
```

## 📁 Project Structure

```
mcp-agent/
├── mcp-servers/              # MCP server implementations
│   ├── mcp-appium-server-new.js    # Mobile automation
│   ├── mcp-filesystem-server.js    # File operations
│   ├── mcp-test-execution-server.js # Test runner
│   └── ...
├── features/                 # Test features by domain
│   ├── common/              # Shared utilities and page objects
│   ├── merchantPayment/     # Payment-related tests
│   ├── walletInfrastructure/ # Wallet functionality tests
│   └── ...
├── multi_tool_agent/        # Multi-agent system
│   └── agent.py            # Google ADK agent implementation
├── automation-state-captures/ # Auto-captured screenshots/logs
└── docs/                    # Documentation
```

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the root directory:

```bash
# Appium Configuration
APPIUM_HOST=localhost
APPIUM_PORT=4723

# Device Configuration
ANDROID_DEVICE_NAME=YourAndroidDevice
IOS_DEVICE_NAME=YourIOSDevice
ANDROID_PLATFORM_VERSION=11
IOS_PLATFORM_VERSION=15.0

# Test Configuration
TEST_TIMEOUT=30000
SCREENSHOT_PATH=./automation-state-captures
```

### MCP Server Configuration
Each MCP server can be configured via environment variables or initialization parameters. See individual server documentation for details.

## 📚 Usage Examples

### Mobile Automation
```javascript
// Connect to device
await mcpClient.callTool('appium_connect', {
  platform: 'Android',
  deviceName: 'MyDevice',
  platformVersion: '11'
});

// Smart element interaction with AI fallback
await mcpClient.callTool('smart_find_and_click', {
  strategy: 'text',
  selector: 'Login',
  fallbackOptions: {
    enableScreenshotAnalysis: true,
    textToFind: 'Login button'
  }
});

// Verify action result
await mcpClient.callTool('verify_action_result', {
  verification: {
    type: 'text_present',
    selector: 'Welcome'
  }
});
```

### Web Automation
```javascript
// Navigate to website
await mcpClient.callTool('browser_navigate', {
  url: 'https://example.com'
});

// Take screenshot
await mcpClient.callTool('browser_take_screenshot', {
  filename: 'login-page.png'
});
```

### File Operations
```javascript
// Search for test files
await mcpClient.callTool('file_search', {
  pattern: '**/*.feature'
});

// Read configuration
await mcpClient.callTool('read_file', {
  filePath: './config/test-config.json'
});
```

## 🧪 Testing

### Run Individual MCP Servers
```bash
cd mcp-servers

# Test Appium server
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | node mcp-appium-server-new.js

# Test other servers
npm run start:test
npm run start:filesystem
```

### Feature Testing
```bash
# Run specific feature tests
cd features
# Execute your test framework commands here
```

## 🔍 Troubleshooting

### Common Issues

1. **Appium Connection Issues**
   - Ensure Appium server is running: `appium --allow-cors`
   - Check device/emulator is connected and accessible
   - Verify platform versions match your device

2. **MCP Server Issues**
   - Check Node.js version: `node --version`
   - Verify all dependencies: `npm list`
   - Check server logs for detailed error messages

3. **Mobile Device Issues**
   - Android: Enable Developer Options and USB Debugging
   - iOS: Trust the development certificate
   - Ensure devices are properly connected via USB or WiFi

### Debug Mode
Enable verbose logging by setting environment variables:
```bash
export DEBUG=true
export LOG_LEVEL=debug
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines
- Follow existing code style and patterns
- Add tests for new features
- Update documentation for changes
- Use meaningful commit messages

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Model Context Protocol](https://github.com/modelcontextprotocol) for the MCP framework
- [Appium](https://appium.io/) for mobile automation capabilities
- [WebDriverIO](https://webdriver.io/) for web automation
- [Google ADK](https://developers.google.com/adk) for multi-agent orchestration

## 📞 Support

- Create an issue for bug reports or feature requests
- Check existing documentation in the `/docs` folder
- Review MCP server logs for troubleshooting

---

**Happy Testing! 🚀**
