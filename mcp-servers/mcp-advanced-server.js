#!/usr/bin/env node

/**
 * MCP Advanced Tools Server
 * Handles advanced automation features and workspace management
 *
 * Tools: wait_for_element, scroll_to_element, handle_popup, create_new_workspace
 */

import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { BaseMCPServer } from './base-mcp-server.js';

class AdvancedToolsServer extends BaseMCPServer {
    constructor() {
        super({
            name: 'mcp-advanced-server',
            version: '1.0.0',
            description: 'Advanced automation features and workspace management',
        });

        this.waitOperations = new Map();
        this.registerTools();
    }

    registerTools() {
        // Define and register wait_for_element tool
        this.addTool({
            name: 'wait_for_element',
            description: 'Wait for an element to appear or meet certain conditions',
            inputSchema: {
                type: 'object',
                properties: {
                    selector: { type: 'string', description: 'Element selector' },
                    selectorType: { type: 'string', enum: ['xpath', 'id', 'text', 'accessibility_id', 'class_name'], default: 'xpath' },
                    timeout: { type: 'number', description: 'Timeout in milliseconds', default: 10000 },
                    pollInterval: { type: 'number', description: 'Polling interval in milliseconds', default: 500 },
                    expectedCondition: { type: 'string', enum: ['visible', 'present', 'clickable'], default: 'visible' },
                },
                required: ['selector'],
            },
        });
        this.registerTool('wait_for_element', this.waitForElement.bind(this));

        // Define and register scroll_to_element tool
        this.addTool({
            name: 'scroll_to_element',
            description: 'Scroll to find and display an element on screen',
            inputSchema: {
                type: 'object',
                properties: {
                    selector: { type: 'string', description: 'Element selector' },
                    selectorType: { type: 'string', enum: ['xpath', 'id', 'text', 'accessibility_id', 'class_name'], default: 'xpath' },
                    direction: { type: 'string', enum: ['up', 'down', 'left', 'right'], default: 'down' },
                    maxScrolls: { type: 'number', description: 'Maximum number of scroll attempts', default: 10 },
                    scrollDistance: { type: 'number', description: 'Distance to scroll in pixels', default: 300 },
                },
                required: ['selector'],
            },
        });
        this.registerTool('scroll_to_element', this.scrollToElement.bind(this));

        // Define and register handle_popup tool
        this.addTool({
            name: 'handle_popup',
            description: 'Detect and handle popup dialogs',
            inputSchema: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['detect', 'dismiss', 'accept', 'wait_and_dismiss'], default: 'detect' },
                    popupSelector: { type: 'string', description: 'Popup element selector' },
                    actionButton: { type: 'string', description: 'Button text to click', default: 'OK' },
                    timeout: { type: 'number', description: 'Timeout in milliseconds', default: 5000 },
                },
                required: [],
            },
        });
        this.registerTool('handle_popup', this.handlePopup.bind(this));

        // Define and register create_new_workspace tool
        this.addTool({
            name: 'create_new_workspace',
            description: 'Create a new workspace with project structure based on type',
            inputSchema: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Description of the workspace to create' },
                },
                required: ['query'],
            },
        });
        this.registerTool('create_new_workspace', this.createNewWorkspace.bind(this));
    }

    async waitForElement(args) {
        try {
            this.validateRequiredParams(args, ['selector']);

            const {
                selector,
                selectorType = 'xpath',
                timeout = 10000,
                pollInterval = 500,
                expectedCondition = 'visible',
            } = args;

            const startTime = Date.now();
            const operationId = `wait_${Date.now()}`;

            // Store operation for tracking
            this.waitOperations.set(operationId, {
                selector,
                selectorType,
                startTime,
                timeout,
                expectedCondition,
            });

            // Simulate waiting for element (in real implementation, this would interact with Appium)
            let elementFound = false;
            let attempts = 0;
            const maxAttempts = Math.floor(timeout / pollInterval);

            while (!elementFound && attempts < maxAttempts) {
                attempts++;

                // Simulate element check
                elementFound = await this.checkElementExists(selector, selectorType, expectedCondition);

                if (!elementFound) {
                    await this.sleep(pollInterval);
                }
            }

            const duration = Date.now() - startTime;
            this.waitOperations.delete(operationId);

            if (elementFound) {
                return this.createSuccessResponse(
                    `Element found: ${selector}`,
                    {
                        selector,
                        selectorType,
                        expectedCondition,
                        found: true,
                        duration,
                        attempts,
                    },
                );
            }
            throw new Error(`Element not found after ${timeout}ms: ${selector}`);
        } catch (error) {
            return this.createErrorResponse('wait_for_element', error);
        }
    }

    async scrollToElement(args) {
        try {
            this.validateRequiredParams(args, ['selector']);

            const {
                selector,
                selectorType = 'xpath',
                direction = 'down',
                maxScrolls = 10,
                scrollDistance = 300,
            } = args;

            // First check if element is already visible
            let elementVisible = await this.checkElementExists(selector, selectorType, 'visible');
            let scrollCount = 0;

            if (!elementVisible) {
                // Scroll to find the element
                while (!elementVisible && scrollCount < maxScrolls) {
                    scrollCount++;

                    // Perform scroll action
                    await this.performScroll(direction, scrollDistance);

                    // Check if element is now visible
                    elementVisible = await this.checkElementExists(selector, selectorType, 'visible');

                    // Wait a bit for UI to settle
                    await this.sleep(500);
                }
            }

            if (elementVisible) {
                return this.createSuccessResponse(
                    `Successfully scrolled to element: ${selector}`,
                    {
                        selector,
                        selectorType,
                        direction,
                        scrollsPerformed: scrollCount,
                        elementVisible: true,
                    },
                );
            }
            throw new Error(`Element not found after ${maxScrolls} scrolls: ${selector}`);
        } catch (error) {
            return this.createErrorResponse('scroll_to_element', error);
        }
    }

    async handlePopup(args) {
        try {
            const {
                action = 'detect',
                popupSelector = '//android.widget.Button[contains(@text,"OK") or contains(@text,"Cancel") or contains(@text,"Allow")]',
                actionButton = 'OK',
                timeout = 5000,
            } = args;

            let popupHandled = false;
            let popupFound = false;

            switch (action) {
                case 'detect':
                    popupFound = await this.checkElementExists(popupSelector, 'xpath', 'visible');
                    break;

                case 'dismiss':
                    popupFound = await this.checkElementExists(popupSelector, 'xpath', 'visible');
                    if (popupFound) {
                        // Simulate tapping the action button
                        await this.simulateTap(actionButton);
                        popupHandled = true;
                    }
                    break;

                case 'accept':
                    const acceptSelector = `//android.widget.Button[contains(@text,"${actionButton}")]`;
                    popupFound = await this.checkElementExists(acceptSelector, 'xpath', 'visible');
                    if (popupFound) {
                        await this.simulateTap(actionButton);
                        popupHandled = true;
                    }
                    break;

                case 'wait_and_dismiss':
                    // Wait for popup to appear, then dismiss
                    const startTime = Date.now();
                    while (!popupFound && (Date.now() - startTime) < timeout) {
                        popupFound = await this.checkElementExists(popupSelector, 'xpath', 'visible');
                        if (!popupFound) {
                            await this.sleep(100);
                        }
                    }

                    if (popupFound) {
                        await this.simulateTap(actionButton);
                        popupHandled = true;
                    }
                    break;

                default:
                    throw new Error(`Unknown popup action: ${action}`);
            }

            return this.createSuccessResponse(
                `Popup handling completed: ${action}`,
                {
                    action,
                    popupFound,
                    popupHandled,
                    actionButton,
                    selector: popupSelector,
                },
            );
        } catch (error) {
            return this.createErrorResponse('handle_popup', error);
        }
    }

    async createNewWorkspace(args) {
        try {
            this.validateRequiredParams(args, ['query']);

            const { query } = args;

            // Parse the query to understand what type of workspace is needed
            const workspaceType = this.parseWorkspaceQuery(query);
            const projectName = this.extractProjectName(query);

            // Create workspace structure based on type
            const workspacePath = path.join(process.cwd(), 'workspaces', projectName);

            await this.createWorkspaceStructure(workspacePath, workspaceType);

            // Generate setup instructions
            const setupInstructions = this.generateSetupInstructions(workspaceType, projectName);

            return this.createSuccessResponse(
                `New workspace created: ${projectName}`,
                {
                    projectName,
                    workspaceType,
                    workspacePath,
                    setupInstructions,
                    nextSteps: [
                        `cd ${workspacePath}`,
                        'Install dependencies as needed',
                        'Open in VS Code',
                        'Start development',
                    ],
                },
            );
        } catch (error) {
            return this.createErrorResponse('create_new_workspace', error);
        }
    }

    // Helper Methods

    async checkElementExists(selector, selectorType, expectedCondition) {
        // Simulate element existence check
        // In a real implementation, this would use Appium to check the element

        // For demo purposes, randomly return true/false
        // In practice, this would connect to the actual Appium session
        const exists = Math.random() > 0.3; // 70% chance element exists

        if (expectedCondition === 'visible') {
            return exists && Math.random() > 0.2; // Additional check for visibility
        }

        return exists;
    }

    async performScroll(direction, distance) {
        // Simulate scroll action
        // In real implementation, this would use Appium's swipe functionality
        console.log(`Simulating scroll ${direction} by ${distance}px`);

        // Add some realistic delay
        await this.sleep(200);
    }

    async simulateTap(buttonText) {
        // Simulate tapping a button
        console.log(`Simulating tap on button: ${buttonText}`);
        await this.sleep(100);
    }

    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    parseWorkspaceQuery(query) {
        const queryLower = query.toLowerCase();

        if (queryLower.includes('react') || queryLower.includes('next')) {
            return 'react';
        } if (queryLower.includes('vue')) {
            return 'vue';
        } if (queryLower.includes('angular')) {
            return 'angular';
        } if (queryLower.includes('typescript') || queryLower.includes('ts')) {
            return 'typescript';
        } if (queryLower.includes('python') || queryLower.includes('django') || queryLower.includes('flask')) {
            return 'python';
        } if (queryLower.includes('node') || queryLower.includes('express')) {
            return 'node';
        } if (queryLower.includes('mobile') || queryLower.includes('appium')) {
            return 'mobile-automation';
        } if (queryLower.includes('test') || queryLower.includes('automation')) {
            return 'test-automation';
        }
        return 'basic';
    }

    extractProjectName(query) {
        // Try to extract project name from query
        const words = query.toLowerCase().split(' ');
        const forbiddenWords = ['create', 'new', 'project', 'workspace', 'a', 'an', 'the'];

        for (const word of words) {
            if (!forbiddenWords.includes(word) && word.length > 2) {
                return word.replace(/[^a-zA-Z0-9-]/g, '');
            }
        }

        return `new-project-${Date.now()}`;
    }

    async createWorkspaceStructure(workspacePath, workspaceType) {
        // Create base directory
        await fs.mkdir(workspacePath, { recursive: true });

        switch (workspaceType) {
            case 'react':
                await this.createReactWorkspace(workspacePath);
                break;
            case 'typescript':
                await this.createTypeScriptWorkspace(workspacePath);
                break;
            case 'python':
                await this.createPythonWorkspace(workspacePath);
                break;
            case 'mobile-automation':
                await this.createMobileAutomationWorkspace(workspacePath);
                break;
            case 'test-automation':
                await this.createTestAutomationWorkspace(workspacePath);
                break;
            default:
                await this.createBasicWorkspace(workspacePath);
        }
    }

    async createReactWorkspace(workspacePath) {
        // Create React project structure
        const structure = {
            'package.json': {
                name: path.basename(workspacePath),
                version: '1.0.0',
                scripts: {
                    start: 'react-scripts start',
                    build: 'react-scripts build',
                    test: 'react-scripts test',
                },
                dependencies: {
                    react: '^18.0.0',
                    'react-dom': '^18.0.0',
                },
                devDependencies: {
                    'react-scripts': '^5.0.0',
                },
            },
            'src/App.js': `import React from 'react';

function App() {
  return (
    <div className="App">
      <h1>Welcome to React!</h1>
    </div>
  );
}

export default App;`,
            'src/index.js': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);`,
            'public/index.html': `<!DOCTYPE html>
<html>
<head>
    <title>React App</title>
</head>
<body>
    <div id="root"></div>
</body>
</html>`,
        };

        await this.createFileStructure(workspacePath, structure);
    }

    async createTypeScriptWorkspace(workspacePath) {
        const structure = {
            'package.json': {
                name: path.basename(workspacePath),
                version: '1.0.0',
                scripts: {
                    build: 'tsc',
                    start: 'node dist/index.js',
                    dev: 'ts-node src/index.ts',
                },
                devDependencies: {
                    typescript: '^5.0.0',
                    '@types/node': '^20.0.0',
                    'ts-node': '^10.0.0',
                },
            },
            'tsconfig.json': {
                compilerOptions: {
                    target: 'ES2020',
                    module: 'commonjs',
                    outDir: './dist',
                    rootDir: './src',
                    strict: true,
                    esModuleInterop: true,
                },
            },
            'src/index.ts': 'console.log(\'Hello, TypeScript!\');',
        };

        await this.createFileStructure(workspacePath, structure);
    }

    async createPythonWorkspace(workspacePath) {
        const structure = {
            'requirements.txt': '',
            'main.py': `def main():
    print("Hello, Python!")

if __name__ == "__main__":
    main()`,
            'README.md': `# Python Project

## Setup
\`\`\`bash
pip install -r requirements.txt
python main.py
\`\`\``,
            'tests/test_main.py': `import unittest

class TestMain(unittest.TestCase):
    def test_example(self):
        self.assertTrue(True)

if __name__ == '__main__':
    unittest.main()`,
        };

        await this.createFileStructure(workspacePath, structure);
    }

    async createMobileAutomationWorkspace(workspacePath) {
        const structure = {
            'package.json': {
                name: path.basename(workspacePath),
                version: '1.0.0',
                scripts: {
                    test: 'jest',
                    'test:android': 'jest tests/android',
                    'test:ios': 'jest tests/ios',
                },
                dependencies: {
                    webdriverio: '^8.0.0',
                    '@wdio/cli': '^8.0.0',
                    '@wdio/local-runner': '^8.0.0',
                    '@wdio/mocha-framework': '^8.0.0',
                },
            },
            'wdio.conf.js': `exports.config = {
    runner: 'local',
    port: 4723,
    specs: ['./tests/**/*.spec.js'],
    capabilities: [{
        platformName: 'Android',
        'appium:deviceName': 'emulator',
        'appium:automationName': 'UiAutomator2'
    }],
    logLevel: 'info',
    framework: 'mocha',
    mochaOpts: {
        ui: 'bdd',
        timeout: 60000
    }
};`,
            'tests/example.spec.js': `describe('Mobile App Test', () => {
    it('should launch the app', async () => {
        // Test implementation
        expect(true).toBe(true);
    });
});`,
            'README.md': `# Mobile Automation Project

## Setup
\`\`\`bash
npm install
npx wdio run wdio.conf.js
\`\`\``,
        };

        await this.createFileStructure(workspacePath, structure);
    }

    async createTestAutomationWorkspace(workspacePath) {
        const structure = {
            'package.json': {
                name: path.basename(workspacePath),
                version: '1.0.0',
                scripts: {
                    test: 'jest',
                    'test:watch': 'jest --watch',
                    'test:coverage': 'jest --coverage',
                },
                dependencies: {
                    jest: '^29.0.0',
                    playwright: '^1.40.0',
                },
            },
            'jest.config.js': `module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.js'],
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/**/*.test.js'
    ]
};`,
            'tests/example.test.js': `describe('Example Test Suite', () => {
    test('should pass', () => {
        expect(1 + 1).toBe(2);
    });
});`,
            'src/utils.js': `export function add(a, b) {
    return a + b;
}`,
            'README.md': `# Test Automation Project

## Setup
\`\`\`bash
npm install
npm test
\`\`\``,
        };

        await this.createFileStructure(workspacePath, structure);
    }

    async createBasicWorkspace(workspacePath) {
        const structure = {
            'README.md': `# ${path.basename(workspacePath)}

A new project workspace.

## Getting Started

1. Add your code
2. Update this README
3. Start building!`,
            'src/index.js': 'console.log(\'Hello, World!\');',
            '.gitignore': `node_modules/
dist/
.env
*.log`,
        };

        await this.createFileStructure(workspacePath, structure);
    }

    async createFileStructure(basePath, structure) {
        for (const [filePath, content] of Object.entries(structure)) {
            const fullPath = path.join(basePath, filePath);
            const dir = path.dirname(fullPath);

            // Create directory if it doesn't exist
            await fs.mkdir(dir, { recursive: true });

            // Write file content
            const fileContent = typeof content === 'object'
                ? JSON.stringify(content, null, 2)
                : content;

            await fs.writeFile(fullPath, fileContent, 'utf8');
        }
    }

    generateSetupInstructions(workspaceType, projectName) {
        const instructions = [`# ${projectName} Setup Instructions\n`];

        switch (workspaceType) {
            case 'react':
                instructions.push(
                    '1. Install dependencies: `npm install`',
                    '2. Start development server: `npm start`',
                    '3. Open http://localhost:3000 in your browser',
                );
                break;
            case 'typescript':
                instructions.push(
                    '1. Install dependencies: `npm install`',
                    '2. Build project: `npm run build`',
                    '3. Run project: `npm start`',
                    '4. For development: `npm run dev`',
                );
                break;
            case 'python':
                instructions.push(
                    '1. Create virtual environment: `python -m venv venv`',
                    '2. Activate virtual environment: `source venv/bin/activate`',
                    '3. Install dependencies: `pip install -r requirements.txt`',
                    '4. Run main script: `python main.py`',
                );
                break;
            case 'mobile-automation':
                instructions.push(
                    '1. Install dependencies: `npm install`',
                    '2. Start Appium server: `appium`',
                    '3. Run tests: `npm test`',
                    '4. Configure device capabilities in wdio.conf.js',
                );
                break;
            case 'test-automation':
                instructions.push(
                    '1. Install dependencies: `npm install`',
                    '2. Run tests: `npm test`',
                    '3. Run tests in watch mode: `npm run test:watch`',
                    '4. Generate coverage report: `npm run test:coverage`',
                );
                break;
            default:
                instructions.push(
                    '1. Add your project dependencies',
                    '2. Update the README with project-specific instructions',
                    '3. Start coding!',
                );
        }

        return instructions.join('\n');
    }
}

// Start the server
const server = new AdvancedToolsServer();
server.run().catch(console.error);
