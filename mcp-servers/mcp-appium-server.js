#!/usr/bin/env node

/**
 * MCP Appium Server
 * Handles device interaction and automation using Appium WebDriver
 *
 * Tools: appium_connect, appium_disconnect, appium_status, appium_install_app, appium_launch_app,
 *        appium_close_app, find_element, find_elements, click_element, type_text, swipe, get_screenshot,
 *        get_page_source
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { remote } from 'webdriverio';
import { BaseMCPServer } from './base-mcp-server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AppiumMCPServer extends BaseMCPServer {
    constructor() {
        super({
            name: 'mcp-appium-server',
            version: '1.0.0',
            description: 'Device interaction and automation using Appium WebDriver',
        });

        this.driver = null;
        this.isConnected = false;
        this.registerTools();
    }

    registerTools() {
        // Register tool schemas
        this.addTool({
            name: 'appium_connect',
            description: 'Connect to Android device via Appium server (local or remote)',
            inputSchema: {
                type: 'object',
                properties: {
                    hostname: {
                        type: 'string',
                        description: 'Appium server hostname (default: localhost)',
                        default: 'localhost',
                    },
                    port: {
                        type: 'number',
                        description: 'Appium server port (default: 4723)',
                        default: 4723,
                    },
                    deviceName: {
                        type: 'string',
                        description: 'Device name or ID',
                        default: 'Android Device',
                    },
                    platformVersion: {
                        type: 'string',
                        description: 'Android platform version',
                        default: '11',
                    },
                    appPackage: {
                        type: 'string',
                        description: 'App package name (optional)',
                    },
                    appActivity: {
                        type: 'string',
                        description: 'App activity name (optional)',
                    },
                    udid: {
                        type: 'string',
                        description: 'Device UDID (optional)',
                    },
                },
            },
        });

        this.addTool({
            name: 'appium_disconnect',
            description: 'Disconnect from the current Appium session',
            inputSchema: {
                type: 'object',
                properties: {},
            },
        });

        this.addTool({
            name: 'appium_status',
            description: 'Get current Appium connection status and device info',
            inputSchema: {
                type: 'object',
                properties: {},
            },
        });

        this.addTool({
            name: 'appium_install_app',
            description: 'Install an APK file on the connected device',
            inputSchema: {
                type: 'object',
                properties: {
                    appPath: {
                        type: 'string',
                        description: 'Path to the APK file to install',
                    },
                },
                required: ['appPath'],
            },
        });

        this.addTool({
            name: 'appium_launch_app',
            description: 'Launch an app on the device by package name',
            inputSchema: {
                type: 'object',
                properties: {
                    packageName: {
                        type: 'string',
                        description: 'Package name of the app to launch',
                    },
                },
                required: ['packageName'],
            },
        });

        this.addTool({
            name: 'appium_close_app',
            description: 'Close/terminate an app on the device',
            inputSchema: {
                type: 'object',
                properties: {
                    packageName: {
                        type: 'string',
                        description: 'Package name of the app to close',
                    },
                },
                required: ['packageName'],
            },
        });

        this.addTool({
            name: 'find_element',
            description: 'Find a single element on the current screen',
            inputSchema: {
                type: 'object',
                properties: {
                    strategy: {
                        type: 'string',
                        enum: ['id', 'xpath', 'className', 'text', 'contentDescription', 'accessibilityId'],
                        description: 'Element location strategy',
                    },
                    selector: {
                        type: 'string',
                        description: 'Element selector value',
                    },
                    timeout: {
                        type: 'number',
                        description: 'Wait timeout in milliseconds (default: 10000)',
                        default: 10000,
                    },
                },
                required: ['strategy', 'selector'],
            },
        });

        this.addTool({
            name: 'find_elements',
            description: 'Find multiple elements on the current screen',
            inputSchema: {
                type: 'object',
                properties: {
                    strategy: {
                        type: 'string',
                        enum: ['id', 'xpath', 'className', 'text', 'contentDescription', 'accessibilityId'],
                        description: 'Element location strategy',
                    },
                    selector: {
                        type: 'string',
                        description: 'Element selector value',
                    },
                    timeout: {
                        type: 'number',
                        description: 'Wait timeout in milliseconds (default: 10000)',
                        default: 10000,
                    },
                },
                required: ['strategy', 'selector'],
            },
        });

        this.addTool({
            name: 'click_element',
            description: 'Click on an element',
            inputSchema: {
                type: 'object',
                properties: {
                    strategy: {
                        type: 'string',
                        enum: ['id', 'xpath', 'className', 'text', 'contentDescription', 'accessibilityId'],
                        description: 'Element location strategy',
                    },
                    selector: {
                        type: 'string',
                        description: 'Element selector value',
                    },
                    timeout: {
                        type: 'number',
                        description: 'Wait timeout in milliseconds (default: 10000)',
                        default: 10000,
                    },
                },
                required: ['strategy', 'selector'],
            },
        });

        this.addTool({
            name: 'type_text',
            description: 'Type text into an input field',
            inputSchema: {
                type: 'object',
                properties: {
                    strategy: {
                        type: 'string',
                        enum: ['id', 'xpath', 'className', 'text', 'contentDescription', 'accessibilityId'],
                        description: 'Element location strategy',
                    },
                    selector: {
                        type: 'string',
                        description: 'Element selector value',
                    },
                    text: {
                        type: 'string',
                        description: 'Text to type',
                    },
                    timeout: {
                        type: 'number',
                        description: 'Wait timeout in milliseconds (default: 10000)',
                        default: 10000,
                    },
                },
                required: ['strategy', 'selector', 'text'],
            },
        });

        this.addTool({
            name: 'swipe',
            description: 'Perform a swipe gesture on the screen',
            inputSchema: {
                type: 'object',
                properties: {
                    startX: {
                        type: 'number',
                        description: 'Starting X coordinate',
                    },
                    startY: {
                        type: 'number',
                        description: 'Starting Y coordinate',
                    },
                    endX: {
                        type: 'number',
                        description: 'Ending X coordinate',
                    },
                    endY: {
                        type: 'number',
                        description: 'Ending Y coordinate',
                    },
                    duration: {
                        type: 'number',
                        description: 'Swipe duration in milliseconds (default: 1000)',
                        default: 1000,
                    },
                },
                required: ['startX', 'startY', 'endX', 'endY'],
            },
        });

        this.addTool({
            name: 'get_screenshot',
            description: 'Take a screenshot of the current screen',
            inputSchema: {
                type: 'object',
                properties: {
                    filename: {
                        type: 'string',
                        description: 'Optional filename to save screenshot (default: timestamp-based)',
                    },
                },
            },
        });

        this.addTool({
            name: 'get_page_source',
            description: 'Get the XML page source of the current screen',
            inputSchema: {
                type: 'object',
                properties: {},
            },
        });

        // Register tool handlers
        this.registerTool('appium_connect', this.handleConnect.bind(this));
        this.registerTool('appium_disconnect', this.handleDisconnect.bind(this));
        this.registerTool('appium_status', this.handleStatus.bind(this));
        this.registerTool('appium_install_app', this.handleInstallApp.bind(this));
        this.registerTool('appium_launch_app', this.handleLaunchApp.bind(this));
        this.registerTool('appium_close_app', this.handleCloseApp.bind(this));
        this.registerTool('find_element', this.handleFindElement.bind(this));
        this.registerTool('find_elements', this.handleFindElements.bind(this));
        this.registerTool('click_element', this.handleClickElement.bind(this));
        this.registerTool('type_text', this.handleTypeText.bind(this));
        this.registerTool('swipe', this.handleSwipe.bind(this));
        this.registerTool('get_screenshot', this.handleGetScreenshot.bind(this));
        this.registerTool('get_page_source', this.handleGetPageSource.bind(this));
    }

    async ensureConnection() {
        if (!this.isConnected || !this.driver) {
            throw new Error('Not connected to device. Please run appium_connect first.');
        }
    }

    async handleConnect(args) {
        try {
            this.validateRequiredParams(args, []);

            const hostname = args.hostname || 'localhost';
            const port = args.port || 4723;
            const deviceName = args.deviceName || 'Android Device';
            const platformVersion = args.platformVersion || '11';
            const { appPackage, appActivity, udid } = args;

            const opts = {
                hostname,
                port,
                path: '/',
                logLevel: 'info',
                capabilities: {
                    alwaysMatch: {
                        platformName: 'Android',
                        'appium:automationName': 'UiAutomator2',
                        'appium:deviceName': deviceName,
                        'appium:platformVersion': platformVersion,
                        'appium:noReset': true,
                        'appium:autoGrantPermissions': true,
                    },
                },
            };

            if (udid) {
                opts.capabilities.alwaysMatch['appium:udid'] = udid;
            }

            if (appPackage) {
                opts.capabilities.alwaysMatch['appium:appPackage'] = appPackage;
            }

            if (appActivity) {
                opts.capabilities.alwaysMatch['appium:appActivity'] = appActivity;
            }

            this.driver = await remote(opts);
            this.isConnected = true;

            const currentActivity = await this.driver.getCurrentActivity();
            const currentPackage = await this.driver.getCurrentPackage();

            return this.createSuccessResponse(
                `Connected to Android device: ${deviceName}`,
                {
                    hostname,
                    port,
                    deviceName,
                    platformVersion,
                    currentActivity,
                    currentPackage,
                },
            );
        } catch (error) {
            return this.createErrorResponse('appium_connect', error);
        }
    }

    async handleDisconnect(args) {
        try {
            if (this.driver) {
                await this.driver.deleteSession();
                this.driver = null;
                this.isConnected = false;
            }

            return this.createSuccessResponse('Disconnected from device');
        } catch (error) {
            return this.createErrorResponse('appium_disconnect', error);
        }
    }

    async handleStatus(args) {
        try {
            if (!this.isConnected || !this.driver) {
                return this.createSuccessResponse('Not connected to any device', {
                    connected: false,
                });
            }

            const currentActivity = await this.driver.getCurrentActivity();
            const currentPackage = await this.driver.getCurrentPackage();

            return this.createSuccessResponse('Device connection active', {
                connected: true,
                currentActivity,
                currentPackage,
            });
        } catch (error) {
            return this.createErrorResponse('appium_status', error);
        }
    }

    async handleInstallApp(args) {
        try {
            this.validateRequiredParams(args, ['appPath']);
            await this.ensureConnection();

            const { appPath } = args;

            await this.driver.installApp(appPath);

            return this.createSuccessResponse(`App installed: ${appPath}`);
        } catch (error) {
            return this.createErrorResponse('appium_install_app', error);
        }
    }

    async handleLaunchApp(args) {
        try {
            this.validateRequiredParams(args, ['packageName']);
            await this.ensureConnection();

            const { packageName } = args;

            await this.driver.activateApp(packageName);
            await this.driver.pause(2000);

            const currentActivity = await this.driver.getCurrentActivity();
            const currentPackage = await this.driver.getCurrentPackage();

            return this.createSuccessResponse(`App launched: ${packageName}`, {
                packageName,
                currentActivity,
                currentPackage,
            });
        } catch (error) {
            return this.createErrorResponse('appium_launch_app', error);
        }
    }

    async handleCloseApp(args) {
        try {
            this.validateRequiredParams(args, ['packageName']);
            await this.ensureConnection();

            const { packageName } = args;

            await this.driver.terminateApp(packageName);

            return this.createSuccessResponse(`App closed: ${packageName}`);
        } catch (error) {
            return this.createErrorResponse('appium_close_app', error);
        }
    }

    async handleFindElement(args) {
        try {
            this.validateRequiredParams(args, ['strategy', 'selector']);
            await this.ensureConnection();

            const { strategy, selector, timeout = 10000 } = args;

            const element = await this.findElementByStrategy(strategy, selector, timeout);

            const text = await element.getText();
            const enabled = await element.isEnabled();
            const displayed = await element.isDisplayed();
            const location = await element.getLocation();
            const size = await element.getSize();

            return this.createSuccessResponse('Element found', {
                strategy,
                selector,
                text,
                enabled,
                displayed,
                location,
                size,
            });
        } catch (error) {
            return this.createErrorResponse('find_element', error);
        }
    }

    async handleFindElements(args) {
        try {
            this.validateRequiredParams(args, ['strategy', 'selector']);
            await this.ensureConnection();

            const { strategy, selector, timeout = 10000 } = args;

            const elements = await this.findElementsByStrategy(strategy, selector, timeout);

            const elementInfo = [];
            for (let i = 0; i < Math.min(elements.length, 10); i++) {
                const element = elements[i];
                try {
                    const text = await element.getText();
                    const enabled = await element.isEnabled();
                    const displayed = await element.isDisplayed();
                    const location = await element.getLocation();
                    const size = await element.getSize();

                    elementInfo.push({
                        index: i,
                        text,
                        enabled,
                        displayed,
                        location,
                        size,
                    });
                } catch (err) {
                    elementInfo.push({
                        index: i,
                        error: err.message,
                    });
                }
            }

            return this.createSuccessResponse(`Found ${elements.length} elements`, {
                strategy,
                selector,
                totalCount: elements.length,
                elements: elementInfo,
            });
        } catch (error) {
            return this.createErrorResponse('find_elements', error);
        }
    }

    async handleClickElement(args) {
        try {
            this.validateRequiredParams(args, ['strategy', 'selector']);
            await this.ensureConnection();

            const { strategy, selector, timeout = 10000 } = args;

            const element = await this.findElementByStrategy(strategy, selector, timeout);
            await element.click();

            return this.createSuccessResponse(`Element clicked: ${selector}`);
        } catch (error) {
            return this.createErrorResponse('click_element', error);
        }
    }

    async handleTypeText(args) {
        try {
            this.validateRequiredParams(args, ['strategy', 'selector', 'text']);
            await this.ensureConnection();

            const {
                strategy, selector, text, timeout = 10000,
            } = args;

            const element = await this.findElementByStrategy(strategy, selector, timeout);
            await element.setValue(text);

            return this.createSuccessResponse(`Text typed: ${text}`);
        } catch (error) {
            return this.createErrorResponse('type_text', error);
        }
    }

    async handleSwipe(args) {
        try {
            this.validateRequiredParams(args, ['startX', 'startY', 'endX', 'endY']);
            await this.ensureConnection();

            const {
                startX, startY, endX, endY, duration = 1000,
            } = args;

            await this.driver.touchAction([
                { action: 'press', x: startX, y: startY },
                { action: 'wait', ms: duration },
                { action: 'moveTo', x: endX, y: endY },
                { action: 'release' },
            ]);

            return this.createSuccessResponse(
                `Swipe performed from (${startX},${startY}) to (${endX},${endY})`,
            );
        } catch (error) {
            return this.createErrorResponse('swipe', error);
        }
    }

    async handleGetScreenshot(args) {
        try {
            await this.ensureConnection();

            let filename = args.filename || `screenshot-${Date.now()}.png`;
            
            // Add .jpg extension if filename doesn't have an extension
            if (filename && !path.extname(filename)) {
                filename = `${filename}.jpg`;
            }
            
            const tempDir = path.join(__dirname, 'temp');
            const filepath = path.join(tempDir, filename);

            await fs.mkdir(tempDir, { recursive: true });

            const screenshot = await this.driver.takeScreenshot();
            await fs.writeFile(filepath, screenshot, 'base64');

            return this.createSuccessResponse(`Screenshot saved: ${filepath}`, {
                filepath,
                filename,
            });
        } catch (error) {
            return this.createErrorResponse('get_screenshot', error);
        }
    }

    async handleGetPageSource(args) {
        try {
            await this.ensureConnection();

            const pageSource = await this.driver.getPageSource();
            const elementCount = (pageSource.match(/<[^/][^>]*>/g) || []).length;

            return this.createSuccessResponse(`Page source retrieved (${elementCount} elements)`, {
                pageSource,
                elementCount,
            });
        } catch (error) {
            return this.createErrorResponse('get_page_source', error);
        }
    }

    async findElementByStrategy(strategy, selector, timeout) {
        const selectorMap = {
            id: `#${selector}`,
            xpath: selector,
            className: `.${selector}`,
            text: `//*[@text="${selector}"]`,
            contentDescription: `//*[@content-desc="${selector}"]`,
            accessibilityId: `~${selector}`,
        };

        const actualSelector = selectorMap[strategy];
        if (!actualSelector) {
            throw new Error(`Unsupported strategy: ${strategy}`);
        }

        const element = await this.driver.$(actualSelector);
        await element.waitForExist({ timeout });
        return element;
    }

    async findElementsByStrategy(strategy, selector, timeout) {
        const selectorMap = {
            id: `#${selector}`,
            xpath: selector,
            className: `.${selector}`,
            text: `//*[@text="${selector}"]`,
            contentDescription: `//*[@content-desc="${selector}"]`,
            accessibilityId: `~${selector}`,
        };

        const actualSelector = selectorMap[strategy];
        if (!actualSelector) {
            throw new Error(`Unsupported strategy: ${strategy}`);
        }

        const elements = await this.driver.$$(actualSelector);
        if (elements.length === 0) {
            await this.driver.waitUntil(
                async () => {
                    const newElements = await this.driver.$$(actualSelector);
                    return newElements.length > 0;
                },
                { timeout },
            );
            return await this.driver.$$(actualSelector);
        }
        return elements;
    }
}

// Start the server
const server = new AppiumMCPServer();
server.run().catch(console.error);
