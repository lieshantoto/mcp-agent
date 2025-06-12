#!/usr/bin/env node

/**
 * MCP Appium Server
 * Handles device interaction and automation using Appium WebDriver for iOS and Android
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
            description: 'Device interaction and automation using Appium WebDriver for iOS and Android',
        });

        this.driver = null;
        this.isConnected = false;
        this.currentPlatform = null;
        this.connectionConfig = null;
        this.sessionTimeout = 300000; // 5 minutes default session timeout
        this.lastActivity = Date.now();
        
        // Auto state capture configuration
        this.autoStateCapture = {
            enabled: true, // Enable by default
            captureBeforeActions: ['click_element', 'type_text', 'swipe', 'scroll_to_element'],
            retainCount: 5, // Keep last 5 captures
            outputDir: './automation-state-captures',
            lastCaptures: [] // Store recent captures for context
        };
        
        // Screenshot analysis and coordinate-based fallback configuration
        this.coordinateFallback = {
            enabled: true,
            confidenceThreshold: 0.7,
            textSimilarityThreshold: 0.8,
            relativePositionTolerance: 0.1,
            maxFallbackAttempts: 3
        };
        
        this.registerTools();
    }

    registerTools() {
        // Register tool schemas
        this.addTool({
            name: 'appium_connect',
            description: 'Connect to iOS or Android device via Appium server (local or remote)',
            inputSchema: {
                type: 'object',
                properties: {
                    platform: {
                        type: 'string',
                        enum: ['iOS', 'Android'],
                        description: 'Target platform (iOS or Android)',
                        default: 'Android',
                    },
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
                        default: 'Device',
                    },
                    platformVersion: {
                        type: 'string',
                        description: 'Platform version (e.g., "11" for Android, "15.0" for iOS)',
                        default: '11',
                    },
                    appPackage: {
                        type: 'string',
                        description: 'App package name (Android only, optional)',
                    },
                    appActivity: {
                        type: 'string',
                        description: 'App activity name (Android only, optional)',
                    },
                    bundleId: {
                        type: 'string',
                        description: 'App bundle identifier (iOS only, optional)',
                    },
                    udid: {
                        type: 'string',
                        description: 'Device UDID (optional)',
                    },
                    // iOS-specific capabilities
                    usePrebuiltWDA: {
                        type: 'boolean',
                        description: 'Use prebuilt WebDriverAgent (iOS only, optional)',
                    },
                    derivedDataPath: {
                        type: 'string',
                        description: 'Path to derived data for WDA (iOS only, optional)',
                    },
                    wdaLocalPort: {
                        type: 'string',
                        description: 'Local port for WebDriverAgent (iOS only, optional)',
                    },
                    wdaConnectionTimeout: {
                        type: 'number',
                        description: 'WDA connection timeout in milliseconds (iOS only, optional)',
                    },
                    wdaStartupRetries: {
                        type: 'number',
                        description: 'Number of WDA startup retries (iOS only, optional)',
                    },
                    autoAcceptAlerts: {
                        type: 'boolean',
                        description: 'Automatically accept iOS alerts (iOS only, optional)',
                    },
                    autoDismissAlerts: {
                        type: 'boolean',
                        description: 'Automatically dismiss iOS alerts (iOS only, optional)',
                    },
                    shouldUseSingletonTestManager: {
                        type: 'boolean',
                        description: 'Use singleton test manager (iOS only, optional)',
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
            description: 'Install an app file on the connected device (APK for Android, IPA for iOS)',
            inputSchema: {
                type: 'object',
                properties: {
                    appPath: {
                        type: 'string',
                        description: 'Path to the app file to install (APK for Android, IPA for iOS)',
                    },
                },
                required: ['appPath'],
            },
        });

        this.addTool({
            name: 'appium_launch_app',
            description: 'Launch an app on the device by package name (Android) or bundle ID (iOS)',
            inputSchema: {
                type: 'object',
                properties: {
                    packageName: {
                        type: 'string',
                        description: 'Package name (Android) or bundle ID (iOS) of the app to launch',
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
                        description: 'Package name (Android) or bundle ID (iOS) of the app to close',
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
                        enum: ['id', 'xpath', 'className', 'text', 'contentDescription', 'accessibilityId', 'iosClassChain', 'iosNsPredicate'],
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
                        enum: ['id', 'xpath', 'className', 'text', 'contentDescription', 'accessibilityId', 'iosClassChain', 'iosNsPredicate'],
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
                        enum: ['id', 'xpath', 'className', 'text', 'contentDescription', 'accessibilityId', 'iosClassChain', 'iosNsPredicate'],
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
                        enum: ['id', 'xpath', 'className', 'text', 'contentDescription', 'accessibilityId', 'iosClassChain', 'iosNsPredicate'],
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

        // iOS-specific tools
        this.addTool({
            name: 'handle_alert',
            description: 'Handle iOS alerts by accepting or dismissing (iOS only)',
            inputSchema: {
                type: 'object',
                properties: {
                    action: {
                        type: 'string',
                        enum: ['accept', 'dismiss'],
                        description: 'Action to take on the alert',
                        default: 'accept',
                    },
                },
            },
        });

        this.addTool({
            name: 'press_home',
            description: 'Press the home button (iOS only)',
            inputSchema: {
                type: 'object',
                properties: {},
            },
        });

        this.addTool({
            name: 'activate_app',
            description: 'Activate/bring app to foreground by bundle ID (iOS) or package name (Android)',
            inputSchema: {
                type: 'object',
                properties: {
                    appId: {
                        type: 'string',
                        description: 'Bundle ID (iOS) or package name (Android) of the app to activate',
                    },
                },
                required: ['appId'],
            },
        });

        this.addTool({
            name: 'check_connection',
            description: 'Check if device connection is active and healthy (non-blocking)',
            inputSchema: {
                type: 'object',
                properties: {
                    includeDetails: {
                        type: 'boolean',
                        description: 'Include detailed connection information',
                        default: false,
                    },
                },
            },
        });

        // Advanced waiting and validation tools
        this.addTool({
            name: 'wait_for_element',
            description: 'Wait for an element to appear or meet certain conditions',
            inputSchema: {
                type: 'object',
                properties: {
                    strategy: {
                        type: 'string',
                        enum: ['id', 'xpath', 'className', 'text', 'contentDescription', 'accessibilityId', 'iosClassChain', 'iosNsPredicate'],
                        description: 'Element location strategy',
                    },
                    selector: {
                        type: 'string',
                        description: 'Element selector',
                    },
                    expectedCondition: {
                        type: 'string',
                        enum: ['visible', 'present', 'clickable'],
                        description: 'Expected condition for the element',
                        default: 'visible',
                    },
                    timeout: {
                        type: 'number',
                        description: 'Timeout in milliseconds',
                        default: 10000,
                    },
                    pollInterval: {
                        type: 'number',
                        description: 'Polling interval in milliseconds',
                        default: 500,
                    },
                },
                required: ['strategy', 'selector'],
            },
        });

        this.addTool({
            name: 'wait_for_text',
            description: 'Wait for specific text to appear or disappear on screen',
            inputSchema: {
                type: 'object',
                properties: {
                    text: {
                        type: 'string',
                        description: 'Text to wait for',
                    },
                    condition: {
                        type: 'string',
                        enum: ['appears', 'disappears'],
                        description: 'Whether to wait for text to appear or disappear',
                        default: 'appears',
                    },
                    timeout: {
                        type: 'number',
                        description: 'Timeout in milliseconds',
                        default: 10000,
                    },
                    pollInterval: {
                        type: 'number',
                        description: 'Polling interval in milliseconds',
                        default: 500,
                    },
                },
                required: ['text'],
            },
        });

        this.addTool({
            name: 'scroll_to_element',
            description: 'Intelligently scroll to find and display an element on screen with smart detection and container optimization',
            inputSchema: {
                type: 'object',
                properties: {
                    strategy: {
                        type: 'string',
                        enum: ['id', 'xpath', 'className', 'text', 'contentDescription', 'accessibilityId', 'iosClassChain', 'iosNsPredicate'],
                        description: 'Element location strategy',
                    },
                    selector: {
                        type: 'string',
                        description: 'Element selector',
                    },
                    direction: {
                        type: 'string',
                        enum: ['up', 'down', 'left', 'right'],
                        description: 'Scroll direction (default: down)',
                        default: 'down',
                    },
                    maxScrolls: {
                        type: 'number',
                        description: 'Maximum number of scroll attempts (default: 15)',
                        default: 15,
                    },
                    scrollDistance: {
                        type: 'number',
                        description: 'Distance to scroll in pixels (default: 300, will be optimized based on screen size)',
                        default: 300,
                    },
                    detectScrollableContainers: {
                        type: 'boolean',
                        description: 'Whether to detect and target scrollable containers for better accuracy (default: true)',
                        default: true,
                    },
                    smartScrollDetection: {
                        type: 'boolean',
                        description: 'Enable smart detection to prevent getting stuck at content boundaries (default: true)',
                        default: true,
                    },
                    waitAfterScroll: {
                        type: 'number',
                        description: 'Time to wait after each scroll for UI to settle (default: 800ms)',
                        default: 800,
                    },
                },
                required: ['strategy', 'selector'],
            },
        });

        this.addTool({
            name: 'verify_action_result',
            description: 'Advanced verification tool that intelligently checks the result of previous actions using multiple strategies. Can verify element visibility, text presence, enabled/disabled states with smart fallback mechanisms including scrolling and alternative selectors. Supports both new structured format and legacy parameters.',
            inputSchema: {
                type: 'object',
                properties: {
                    verification: {
                        type: 'object',
                        description: 'Structured verification specification with smart fallback capabilities',
                        properties: {
                            type: {
                                type: 'string',
                                enum: ['element_visible', 'element_hidden', 'text_present', 'text_absent', 'element_enabled', 'element_disabled'],
                                description: 'Type of verification to perform - element_visible checks if element exists and is displayed, element_hidden checks if element is not visible, text_present/absent check for text in page source, element_enabled/disabled check interactive state',
                            },
                            strategy: {
                                type: 'string',
                                enum: ['id', 'xpath', 'className', 'text', 'contentDescription', 'accessibilityId', 'iosClassChain', 'iosNsPredicate'],
                                description: 'Element location strategy (required for element verifications) - tool will try alternative strategies as fallback',
                            },
                            selector: {
                                type: 'string',
                                description: 'Element selector or text to verify - exact value to search for using the specified strategy',
                            },
                        },
                        required: ['type', 'selector'],
                    },
                    timeout: {
                        type: 'number',
                        description: 'Maximum timeout for verification attempts in milliseconds',
                        default: 5000,
                    },
                    waitAfterAction: {
                        type: 'number',
                        description: 'Time to wait before starting verification to allow UI updates',
                        default: 1000,
                    },
                    enableScrolling: {
                        type: 'boolean',
                        description: 'Enable intelligent scrolling to find elements not currently visible on screen',
                        default: false,
                    },
                    maxScrollAttempts: {
                        type: 'number',
                        description: 'Maximum number of scroll attempts when enableScrolling is true',
                        default: 3,
                    },
                    // Legacy parameters for backward compatibility
                    expectedText: {
                        type: 'string',
                        description: 'Legacy parameter: Text to verify is present in page source (use verification.type=text_present instead)',
                    },
                    expectedElement: {
                        type: 'string',
                        description: 'Legacy parameter: Element selector to verify is visible (use verification instead)',
                    },
                },
                // At least one of the main parameters must be provided
                required: [],
            },
        });

        this.addTool({
            name: 'smart_wait',
            description: 'Intelligent waiting based on loading states, network activity, or animations',
            inputSchema: {
                type: 'object',
                properties: {
                    waitType: {
                        type: 'string',
                        enum: ['loading_spinner', 'network_idle', 'animation_complete', 'custom_condition'],
                        description: 'Type of smart wait to perform',
                    },
                    condition: {
                        type: 'object',
                        properties: {
                            strategy: {
                                type: 'string',
                                enum: ['id', 'xpath', 'className', 'text', 'contentDescription', 'accessibilityId', 'iosClassChain', 'iosNsPredicate'],
                                description: 'Element location strategy for custom condition',
                            },
                            selector: {
                                type: 'string',
                                description: 'Element selector for custom condition',
                            },
                            expectedState: {
                                type: 'string',
                                enum: ['visible', 'hidden', 'enabled', 'disabled'],
                                description: 'Expected state for custom condition',
                            },
                        },
                    },
                    timeout: {
                        type: 'number',
                        description: 'Maximum wait time in milliseconds',
                        default: 30000,
                    },
                    pollInterval: {
                        type: 'number',
                        description: 'Polling interval in milliseconds',
                        default: 1000,
                    },
                },
                required: ['waitType'],
            },
        });



        this.addTool({
            name: 'capture_state',
            description: 'Manually capture current device state (screenshot and page source) and get state capture context',
            inputSchema: {
                type: 'object',
                properties: {
                    actionName: {
                        type: 'string',
                        description: 'Name to identify this capture (default: manual_capture)',
                        default: 'manual_capture',
                    },
                    getContext: {
                        type: 'boolean',
                        description: 'Whether to include state capture configuration and recent captures in response',
                        default: true,
                    },
                },
            },
        });

        this.addTool({
            name: 'smart_find_and_click',
            description: 'Advanced element interaction tool that intelligently finds and clicks elements using a multi-layered fallback system. Combines traditional element selectors with smart scrolling, AI-powered screenshot analysis, and coordinate-based clicking. Automatically handles overlays, popups, and dynamic content. Ideal for complex mobile automation scenarios where simple element finding may fail due to UI changes, loading states, or accessibility issues.',
            inputSchema: {
                type: 'object',
                properties: {
                    strategy: {
                        type: 'string',
                        enum: ['id', 'xpath', 'className', 'text', 'contentDescription', 'accessibilityId', 'iosClassChain', 'iosNsPredicate'],
                        description: 'Primary element location strategy - the tool will try this method first before falling back to alternatives',
                    },
                    selector: {
                        type: 'string',
                        description: 'Primary element selector value - the exact value to search for using the specified strategy',
                    },
                    fallbackOptions: {
                        type: 'object',
                        description: 'Advanced fallback options when primary strategy fails - enables AI analysis, relative positioning, and coordinate hints',
                        properties: {
                            enableScreenshotAnalysis: {
                                type: 'boolean',
                                description: 'Enable AI-powered screenshot analysis for coordinate-based clicking when element selectors fail',
                                default: true
                            },
                            textToFind: {
                                type: 'string',
                                description: 'Specific text content to look for in screenshot analysis - helps AI identify the correct element'
                            },
                            relativeToElement: {
                                type: 'object',
                                properties: {
                                    strategy: { type: 'string' },
                                    selector: { type: 'string' },
                                    position: {
                                        type: 'string',
                                        enum: ['above', 'below', 'left', 'right', 'inside'],
                                        description: 'Position relative to reference element'
                                    },
                                    offsetX: { type: 'number', description: 'X offset from reference position' },
                                    offsetY: { type: 'number', description: 'Y offset from reference position' }
                                }
                            },
                            coordinateHints: {
                                type: 'object',
                                properties: {
                                    x: { type: 'number', description: 'Relative X position (0.0-1.0)' },
                                    y: { type: 'number', description: 'Relative Y position (0.0-1.0)' },
                                    width: { type: 'number', description: 'Expected element width ratio' },
                                    height: { type: 'number', description: 'Expected element height ratio' }
                                }
                            }
                        }
                    },
                    timeout: {
                        type: 'number',
                        description: 'Maximum wait time in milliseconds for element to appear before trying fallback strategies (default: 10000)',
                        default: 10000,
                    },
                    enableScrolling: {
                        type: 'boolean',
                        description: 'Enable intelligent scrolling to find elements not currently visible on screen - automatically detects scrollable containers (default: false)',
                        default: false,
                    },
                    scrollDirection: {
                        type: 'string',
                        enum: ['up', 'down', 'left', 'right'],
                        description: 'Primary scroll direction for element search - tool will also try opposite direction if needed (default: down for mobile-optimized search)',
                        default: 'down',
                    },
                    maxScrollAttempts: {
                        type: 'number',
                        description: 'Maximum number of scroll attempts before switching to coordinate-based fallback - prevents infinite scrolling (default: 8)',
                        default: 8,
                    },
                },
                required: ['strategy', 'selector'],
            },
        });

        this.addTool({
            name: 'analyze_screenshot',
            description: 'Analyze screenshot to find elements and suggest coordinates',
            inputSchema: {
                type: 'object',
                properties: {
                    targetDescription: {
                        type: 'string',
                        description: 'Description of what to find (e.g., "login button", "username field")'
                    },
                    textToFind: {
                        type: 'string',
                        description: 'Specific text to locate in the screenshot'
                    },
                    elementType: {
                        type: 'string',
                        enum: ['button', 'input', 'text', 'image', 'any'],
                        description: 'Type of element to find',
                        default: 'any'
                    },
                    region: {
                        type: 'object',
                        properties: {
                            x: { type: 'number', description: 'Search region X (0.0-1.0)' },
                            y: { type: 'number', description: 'Search region Y (0.0-1.0)' },
                            width: { type: 'number', description: 'Search region width (0.0-1.0)' },
                            height: { type: 'number', description: 'Search region height (0.0-1.0)' }
                        }
                    }
                },
                required: ['targetDescription']
            }
        });

        this.addTool({
            name: 'tap_coordinates',
            description: 'Tap at specific coordinates with various coordinate systems',
            inputSchema: {
                type: 'object',
                properties: {
                    x: {
                        type: 'number',
                        description: 'X coordinate'
                    },
                    y: {
                        type: 'number',
                        description: 'Y coordinate'
                    },
                    coordinateSystem: {
                        type: 'string',
                        enum: ['absolute', 'relative', 'relative_to_element'],
                        description: 'Coordinate system type',
                        default: 'absolute'
                    },
                    referenceElement: {
                        type: 'object',
                        properties: {
                            strategy: { type: 'string' },
                            selector: { type: 'string' }
                        },
                        description: 'Reference element for relative coordinates'
                    },
                    duration: {
                        type: 'number',
                        description: 'Tap duration in milliseconds',
                        default: 100
                    }
                },
                required: ['x', 'y']
            }
        });

        this.addTool({
            name: 'capture_step_screenshot',
            description: 'Capture screenshot for a specific step with detailed context and assertion guidance - ideal for step-by-step workflow validation',
            inputSchema: {
                type: 'object',
                properties: {
                    stepNumber: {
                        type: 'number',
                        description: 'Step number in the workflow sequence'
                    },
                    stepDescription: {
                        type: 'string',
                        description: 'Description of what this step accomplished'
                    },
                    expectedOutcome: {
                        type: 'string',
                        description: 'What the user should expect to see in this screenshot'
                    },
                    assertionPoints: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Specific UI elements or states to validate in this step'
                    },
                    filename: {
                        type: 'string',
                        description: 'Custom filename for the screenshot (auto-generated if not provided)'
                    },
                    includePageSource: {
                        type: 'boolean',
                        description: 'Whether to include page source XML for detailed analysis',
                        default: true
                    }
                },
                required: ['stepNumber', 'stepDescription']
            }
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
        this.registerTool('handle_alert', this.handleAlert.bind(this));
        this.registerTool('press_home', this.handlePressHome.bind(this));
        this.registerTool('activate_app', this.handleActivateApp.bind(this));
        this.registerTool('check_connection', this.handleCheckConnection.bind(this));
        this.registerTool('wait_for_element', this.handleWaitForElement.bind(this));
        this.registerTool('wait_for_text', this.handleWaitForText.bind(this));
        this.registerTool('scroll_to_element', this.handleScrollToElement.bind(this));
        this.registerTool('verify_action_result', this.handleVerifyActionResult.bind(this));
        this.registerTool('smart_wait', this.handleSmartWait.bind(this));
        this.registerTool('capture_state', this.handleCaptureState.bind(this));
        this.registerTool('smart_find_and_click', this.handleSmartFindAndClick.bind(this));
        this.registerTool('analyze_screenshot', this.handleAnalyzeScreenshot.bind(this));
        this.registerTool('tap_coordinates', this.handleTapCoordinates.bind(this));
        this.registerTool('capture_step_screenshot', this.handleCaptureStepScreenshot.bind(this));
    }

    async ensureConnection() {
        if (!this.isConnected || !this.driver) {
            throw new Error('Not connected to device. Please run appium_connect first.');
        }

        // Check if session is still alive by sending a simple command
        try {
            await this.driver.getWindowSize();
            this.lastActivity = Date.now();
        } catch (error) {
            console.warn('Session appears to be dead, attempting to reconnect...');
            if (this.connectionConfig) {
                try {
                    await this.reconnect();
                    console.log('Successfully reconnected to device');
                } catch (reconnectError) {
                    this.isConnected = false;
                    this.driver = null;
                    throw new Error(`Session lost and reconnection failed: ${reconnectError.message}. Please run appium_connect again.`);
                }
            } else {
                this.isConnected = false;
                this.driver = null;
                throw new Error('Session lost and no connection config stored. Please run appium_connect again.');
            }
        }
    }

    async reconnect() {
        if (!this.connectionConfig) {
            throw new Error('No connection configuration stored for reconnection');
        }

        const { remote } = await import('webdriverio');
        this.driver = await remote(this.connectionConfig);
        this.isConnected = true;
        this.lastActivity = Date.now();
    }

    // Add session keepalive functionality
    startSessionKeepalive() {
        if (this.keepaliveInterval) {
            clearInterval(this.keepaliveInterval);
        }

        this.keepaliveInterval = setInterval(async () => {
            if (this.isConnected && this.driver) {
                const timeSinceLastActivity = Date.now() - this.lastActivity;
                
                // Send a keepalive ping if no activity for 2 minutes
                if (timeSinceLastActivity > 120000) {
                    try {
                        await this.driver.getWindowSize();
                        this.lastActivity = Date.now();
                    } catch (error) {
                        console.warn('Keepalive ping failed:', error.message);
                    }
                }
            }
        }, 60000); // Check every minute
    }

    stopSessionKeepalive() {
        if (this.keepaliveInterval) {
            clearInterval(this.keepaliveInterval);
            this.keepaliveInterval = null;
        }
    }

    async handleConnect(args) {
        try {
            this.validateRequiredParams(args, []);

            const platform = args.platform || 'Android';
            const hostname = args.hostname || 'localhost';
            const port = args.port || 4723;
            const deviceName = args.deviceName || `${platform} Device`;
            const platformVersion = args.platformVersion || (platform === 'iOS' ? '15.0' : '11');
            const { 
                appPackage, 
                appActivity, 
                bundleId, 
                udid,
                usePrebuiltWDA,
                derivedDataPath,
                wdaLocalPort,
                wdaConnectionTimeout,
                wdaStartupRetries,
                autoAcceptAlerts,
                autoDismissAlerts,
                shouldUseSingletonTestManager
            } = args;

            const opts = {
                hostname,
                port,
                path: '/',
                logLevel: 'info',
                capabilities: {
                    alwaysMatch: {
                        platformName: platform,
                        'appium:deviceName': deviceName,
                        'appium:platformVersion': platformVersion,
                        'appium:noReset': true,
                        'appium:newCommandTimeout': 600,
                    },
                },
            };

            // Platform-specific configurations
            if (platform === 'iOS') {
                opts.capabilities.alwaysMatch['appium:automationName'] = 'XCUITest';
                
                // Set default iOS alert handling if not specified
                opts.capabilities.alwaysMatch['appium:autoAcceptAlerts'] = autoAcceptAlerts !== undefined ? autoAcceptAlerts : true;
                opts.capabilities.alwaysMatch['appium:autoDismissAlerts'] = autoDismissAlerts !== undefined ? autoDismissAlerts : false;
                
                if (bundleId) {
                    opts.capabilities.alwaysMatch['appium:bundleId'] = bundleId;
                }

                // iOS-specific WDA capabilities
                if (usePrebuiltWDA !== undefined) {
                    opts.capabilities.alwaysMatch['appium:usePrebuiltWDA'] = usePrebuiltWDA;
                }

                if (derivedDataPath) {
                    opts.capabilities.alwaysMatch['appium:derivedDataPath'] = derivedDataPath;
                }

                if (wdaLocalPort) {
                    opts.capabilities.alwaysMatch['appium:wdaLocalPort'] = wdaLocalPort;
                }

                if (wdaConnectionTimeout) {
                    opts.capabilities.alwaysMatch['appium:wdaConnectionTimeout'] = wdaConnectionTimeout;
                }

                if (wdaStartupRetries) {
                    opts.capabilities.alwaysMatch['appium:wdaStartupRetries'] = wdaStartupRetries;
                }

                if (shouldUseSingletonTestManager !== undefined) {
                    opts.capabilities.alwaysMatch['appium:shouldUseSingletonTestManager'] = shouldUseSingletonTestManager;
                }
            } else {
                opts.capabilities.alwaysMatch['appium:automationName'] = 'UiAutomator2';
                opts.capabilities.alwaysMatch['appium:autoGrantPermissions'] = true;
                
                if (appPackage) {
                    opts.capabilities.alwaysMatch['appium:appPackage'] = appPackage;
                }

                if (appActivity) {
                    opts.capabilities.alwaysMatch['appium:appActivity'] = appActivity;
                }
            }

            if (udid) {
                opts.capabilities.alwaysMatch['appium:udid'] = udid;
            }

            this.driver = await remote(opts);
            this.isConnected = true;
            this.currentPlatform = platform;
            
            // Store connection config for auto-reconnect
            this.connectionConfig = opts;
            this.lastActivity = Date.now();
            
            // Start session keepalive
            this.startSessionKeepalive();

            let currentInfo = {};
            try {
                if (platform === 'Android') {
                    currentInfo.currentActivity = await this.driver.getCurrentActivity();
                    currentInfo.currentPackage = await this.driver.getCurrentPackage();
                } else {
                    // For iOS, get bundle ID if available
                    try {
                        const source = await this.driver.getPageSource();
                        currentInfo.pageSourceLength = source.length;
                    } catch (e) {
                        // Ignore if page source is not available
                    }
                }
            } catch (e) {
                // Ignore errors when getting current info
                console.warn('Could not get current app info:', e.message);
            }

            return this.createSuccessResponse(
                `Connected to ${platform} device: ${deviceName}`,
                {
                    platform,
                    hostname,
                    port,
                    deviceName,
                    platformVersion,
                    udid,
                    bundleId: platform === 'iOS' ? bundleId : undefined,
                    appPackage: platform === 'Android' ? appPackage : undefined,
                    capabilities: opts.capabilities.alwaysMatch,
                    ...currentInfo,
                },
            );
        } catch (error) {
            return this.createErrorResponse('appium_connect', error);
        }
    }

    async handleDisconnect(args) {
        try {
            // Stop keepalive first
            this.stopSessionKeepalive();
            
            if (this.driver) {
                await this.driver.deleteSession();
                this.driver = null;
                this.isConnected = false;
                this.currentPlatform = null;
                this.connectionConfig = null;
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
                    platform: null,
                    sessionActive: false,
                    connectionConfig: this.connectionConfig ? {
                        hostname: this.connectionConfig.hostname,
                        port: this.connectionConfig.port,
                        deviceName: this.connectionConfig.capabilities?.alwaysMatch?.['appium:deviceName'] || 'Unknown',
                        platformVersion: this.connectionConfig.capabilities?.alwaysMatch?.['appium:platformVersion'] || 'Unknown'
                    } : null
                });
            }

            let currentInfo = { 
                connected: this.isConnected, 
                platform: this.currentPlatform,
                sessionActive: false,
                lastActivity: new Date(this.lastActivity).toISOString(),
                connectionConfig: this.connectionConfig ? {
                    hostname: this.connectionConfig.hostname,
                    port: this.connectionConfig.port,
                    deviceName: this.connectionConfig.capabilities?.alwaysMatch?.['appium:deviceName'] || 'Unknown',
                    platformVersion: this.connectionConfig.capabilities?.alwaysMatch?.['appium:platformVersion'] || 'Unknown',
                    udid: this.connectionConfig.capabilities?.alwaysMatch?.['appium:udid']
                } : null
            };
            
            try {
                // Test if session is still alive with a lightweight operation
                const windowSize = await this.driver.getWindowSize();
                currentInfo.sessionActive = true;
                currentInfo.windowSize = windowSize;
                this.lastActivity = Date.now();
                
                // Get platform-specific information
                if (this.currentPlatform === 'Android') {
                    try {
                        currentInfo.currentActivity = await this.driver.getCurrentActivity();
                        currentInfo.currentPackage = await this.driver.getCurrentPackage();
                    } catch (e) {
                        console.warn('Could not get Android app info:', e.message);
                        currentInfo.androidInfoError = e.message;
                    }
                } else if (this.currentPlatform === 'iOS') {
                    try {
                        currentInfo.orientation = await this.driver.getOrientation();
                        // Try to get page source length as a health indicator
                        const source = await this.driver.getPageSource();
                        currentInfo.pageSourceLength = source.length;
                        currentInfo.hasContent = source.length > 100;
                    } catch (e) {
                        console.warn('Could not get iOS info:', e.message);
                        currentInfo.iosInfoError = e.message;
                    }
                }
                
                return this.createSuccessResponse('Device connection active and healthy', currentInfo);
            } catch (e) {
                console.warn('Session validation failed:', e.message);
                currentInfo.sessionActive = false;
                currentInfo.sessionError = e.message;
                
                // Mark as disconnected if session is dead
                if (e.message.includes('session') || e.message.includes('Session') || 
                    e.message.includes('connection') || e.message.includes('timeout')) {
                    this.isConnected = false;
                    currentInfo.connected = false;
                    currentInfo.needsReconnection = true;
                }
                
                return this.createSuccessResponse('Connection exists but session is not healthy', currentInfo);
            }
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

            // Use state capture wrapper for this action - it will automatically capture state before action
            return await this.performActionWithStateCapture('click_element', async () => {
                // Wait for element to be clickable
                const element = await this.findElementByStrategy(strategy, selector, timeout);
                
                // Verify element is clickable
                const isEnabled = await element.isEnabled();
                const isDisplayed = await element.isDisplayed();
                
                if (!isEnabled) {
                    throw new Error(`Element is not enabled: ${selector}`);
                }
                
                if (!isDisplayed) {
                    throw new Error(`Element is not visible: ${selector}`);
                }

                // Perform click
                await element.click();
                
                // Wait a moment for any immediate UI changes
                await this.driver.pause(500);

                return this.createSuccessResponse(`✅ Element clicked: ${selector}`, {
                    selector,
                    strategy,
                    wasEnabled: isEnabled,
                    wasDisplayed: isDisplayed,
                    clickPerformed: true,
                    note: "State automatically captured before action - check stateCapture field for details"
                });
            }, args);
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

            // Use state capture wrapper for this action - it will automatically capture state before action
            return await this.performActionWithStateCapture('type_text', async () => {
                // Wait for element to be available for input
                const element = await this.findElementByStrategy(strategy, selector, timeout);
                
                // Verify element is enabled and visible
                const isEnabled = await element.isEnabled();
                const isDisplayed = await element.isDisplayed();
                
                if (!isEnabled) {
                    throw new Error(`Input element is not enabled: ${selector}`);
                }
                
                if (!isDisplayed) {
                    throw new Error(`Input element is not visible: ${selector}`);
                }

                // Clear existing text first (if any)
                try {
                    await element.clearValue();
                } catch (error) {
                    // Some elements don't support clearValue, continue
                }

                // Type the text
                await element.setValue(text);
                
                // Wait a moment for any immediate UI changes
                await this.driver.pause(500);
                
                // Verify text was entered (best effort)
                let verificationResult = null;
                try {
                    const currentValue = await element.getValue();
                    verificationResult = {
                        expectedText: text,
                        actualText: currentValue,
                        textMatches: currentValue === text
                    };
                } catch (error) {
                    // Some elements don't support getValue
                    verificationResult = { note: 'Text verification not supported for this element type' };
                }

                return this.createSuccessResponse(`✅ Text typed: ${text}`, {
                    selector,
                    strategy,
                    text,
                    wasEnabled: isEnabled,
                    wasDisplayed: isDisplayed,
                    verification: verificationResult,
                    note: "State automatically captured before action - check stateCapture field for details"
                });
            }, args);
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

            // Use state capture wrapper for this action - it will automatically capture state before action
            return await this.performActionWithStateCapture('swipe', async () => {
                if (this.currentPlatform === 'iOS') {
                    // Use iOS-specific gesture for swiping
                    await this.driver.execute('mobile: swipe', {
                        startX,
                        startY,
                        endX,
                        endY,
                        duration: duration / 1000, // iOS expects duration in seconds
                    });
                } else {
                    // Use Android touchAction
                    await this.driver.touchAction([
                        { action: 'press', x: startX, y: startY },
                        { action: 'wait', ms: duration },
                        { action: 'moveTo', x: endX, y: endY },
                        { action: 'release' },
                    ]);
                }

                return this.createSuccessResponse(
                    `✅ Swipe performed from (${startX},${startY}) to (${endX},${endY})`,
                    {
                        startX,
                        startY,
                        endX,
                        endY,
                        duration,
                        note: "State automatically captured before action - check stateCapture field for details"
                    }
                );
            }, args);
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

    async handleAlert(args) {
        try {
            await this.ensureConnection();
            
            if (this.currentPlatform !== 'iOS') {
                throw new Error('Alert handling is only supported on iOS');
            }

            const action = args.action || 'accept';
            
            try {
                if (action === 'accept') {
                    await this.driver.acceptAlert();
                } else {
                    await this.driver.dismissAlert();
                }
                
                return this.createSuccessResponse(`Alert ${action}ed successfully`);
            } catch (error) {
                // No alert present
                return this.createSuccessResponse('No alert found to handle');
            }
        } catch (error) {
            return this.createErrorResponse('handle_alert', error);
        }
    }

    async handlePressHome(args) {
        try {
            await this.ensureConnection();
            
            if (this.currentPlatform !== 'iOS') {
                throw new Error('Home button press is only supported on iOS');
            }

            await this.driver.execute('mobile: pressButton', { name: 'home' });
            
            return this.createSuccessResponse('Home button pressed');
        } catch (error) {
            return this.createErrorResponse('press_home', error);
        }
    }

    async handleActivateApp(args) {
        try {
            this.validateRequiredParams(args, ['appId']);
            await this.ensureConnection();

            const { appId } = args;

            await this.driver.activateApp(appId);
            await this.driver.pause(2000);

            let currentInfo = {};
            try {
                if (this.currentPlatform === 'Android') {
                    currentInfo.currentActivity = await this.driver.getCurrentActivity();
                    currentInfo.currentPackage = await this.driver.getCurrentPackage();
                } else {
                    currentInfo.bundleId = appId;
                }
            } catch (e) {
                // Ignore errors getting current info
            }

            return this.createSuccessResponse(`App activated: ${appId}`, {
                appId,
                platform: this.currentPlatform,
                ...currentInfo,
            });
        } catch (error) {
            return this.createErrorResponse('activate_app', error);
        }
    }

    async handleCheckConnection(args) {
        try {
            const includeDetails = args.includeDetails || false;
            
            const result = {
                connected: this.isConnected,
                platform: this.currentPlatform,
                sessionActive: false,
                connectionHealthy: false,
            };

            if (!this.isConnected || !this.driver) {
                return this.createSuccessResponse('No active connection', result);
            }

            // Test if session is still alive with a lightweight operation
            try {
                await this.driver.getWindowSize();
                result.sessionActive = true;
                result.connectionHealthy = true;
                this.lastActivity = Date.now();
                
                if (includeDetails) {
                    result.lastActivity = new Date(this.lastActivity).toISOString();
                    result.connectionConfig = this.connectionConfig ? {
                        hostname: this.connectionConfig.hostname,
                        port: this.connectionConfig.port,
                        deviceName: this.connectionConfig.capabilities.alwaysMatch['appium:deviceName'],
                        platformVersion: this.connectionConfig.capabilities.alwaysMatch['appium:platformVersion'],
                        udid: this.connectionConfig.capabilities.alwaysMatch['appium:udid']
                    } : null;
                    
                    // Try to get current app info
                    try {
                        if (this.currentPlatform === 'Android') {
                            result.currentActivity = await this.driver.getCurrentActivity();
                            result.currentPackage = await this.driver.getCurrentPackage();
                        } else if (this.currentPlatform === 'iOS') {
                            const source = await this.driver.getPageSource();
                            result.pageSourceLength = source.length;
                        }
                    } catch (e) {
                        // Ignore if app info is not available
                    }
                }
                
                return this.createSuccessResponse('Connection is healthy and active', result);
            } catch (error) {
                result.sessionActive = false;
                result.connectionHealthy = false;
                result.error = error.message;
                
                return this.createSuccessResponse('Connection exists but session is not healthy', result);
            }
        } catch (error) {
            return this.createErrorResponse('check_connection', error);
        }
    }

    async findElementByStrategy(strategy, selector, timeout) {
        const selectorMap = {
            id: `#${selector}`,
            xpath: selector,
            className: `.${selector}`,
            text: this.currentPlatform === 'iOS' ? `//*[@label="${selector}" or @name="${selector}" or @value="${selector}"]` : `//*[@text="${selector}"]`,
            contentDescription: this.currentPlatform === 'iOS' ? `//*[@label="${selector}" or @name="${selector}"]` : `//*[@content-desc="${selector}"]`,
            accessibilityId: `~${selector}`,
            iosClassChain: selector, // iOS-specific class chain selector
            iosNsPredicate: selector, // iOS-specific NSPredicate selector
        };

        const actualSelector = selectorMap[strategy];
        if (!actualSelector) {
            throw new Error(`Unsupported strategy: ${strategy}`);
        }

        let element;
        if (strategy === 'iosClassChain') {
            element = await this.driver.$(`-ios class chain:${selector}`);
        } else if (strategy === 'iosNsPredicate') {
            element = await this.driver.$(`-ios predicate string:${selector}`);
        } else {
            element = await this.driver.$(actualSelector);
        }
        
        await element.waitForExist({ timeout });
        return element;
    }

    async findElementsByStrategy(strategy, selector, timeout) {
        const selectorMap = {
            id: `#${selector}`,
            xpath: selector,
            className: `.${selector}`,
            text: this.currentPlatform === 'iOS' ? `//*[@label="${selector}" or @name="${selector}" or @value="${selector}"]` : `//*[@text="${selector}" or @content-desc="${selector}"]`,
            contentDescription: this.currentPlatform === 'iOS' ? `//*[@label="${selector}" or @name="${selector}"]` : `//*[@content-desc="${selector}"]`,
            accessibilityId: `~${selector}`,
            iosClassChain: selector, // iOS-specific class chain selector
            iosNsPredicate: selector, // iOS-specific NSPredicate selector
        };

        const actualSelector = selectorMap[strategy];
        if (!actualSelector) {
            throw new Error(`Unsupported strategy: ${strategy}`);
        }

        let elements;
        if (strategy === 'iosClassChain') {
            elements = await this.driver.$$(`-ios class chain:${selector}`);
        } else if (strategy === 'iosNsPredicate') {
            elements = await this.driver.$$(`-ios predicate string:${selector}`);
        } else {
            elements = await this.driver.$$(actualSelector);
        }

        if (elements.length === 0) {
            await this.driver.waitUntil(
                async () => {
                    let newElements;
                    if (strategy === 'iosClassChain') {
                        newElements = await this.driver.$$(`-ios class chain:${selector}`);
                    } else if (strategy === 'iosNsPredicate') {
                        newElements = await this.driver.$$(`-ios predicate string:${selector}`);
                    } else {
                        newElements = await this.driver.$$(actualSelector);
                    }
                    return newElements.length > 0;
                },
                { timeout },
            );
            
            if (strategy === 'iosClassChain') {
                return await this.driver.$$(`-ios class chain:${selector}`);
            } else if (strategy === 'iosNsPredicate') {
                return await this.driver.$$(`-ios predicate string:${selector}`);
            } else {
                return await this.driver.$$(actualSelector);
            }
        }
        return elements;
    }

    // Automatic state capture functionality
    async captureCurrentState(actionName, actionParams = {}) {
        if (!this.autoStateCapture.enabled || !this.isConnected) {
            return null;
        }

        try {
            const timestamp = Date.now();
            const captureId = `${actionName}_${timestamp}`;
            
            // Ensure capture directory exists
            await fs.mkdir(this.autoStateCapture.outputDir, { recursive: true });

            // Capture screenshot
            let screenshotPath = null;
            try {
                const screenshot = await this.driver.takeScreenshot();
                screenshotPath = path.join(this.autoStateCapture.outputDir, `${captureId}_screenshot.png`);
                await fs.writeFile(screenshotPath, screenshot, 'base64');
            } catch (error) {
                console.warn('Failed to capture screenshot:', error.message);
            }

            // Capture page source
            let pageSourcePath = null;
            try {
                const pageSource = await this.driver.getPageSource();
                pageSourcePath = path.join(this.autoStateCapture.outputDir, `${captureId}_page_source.xml`);
                await fs.writeFile(pageSourcePath, pageSource, 'utf8');
            } catch (error) {
                console.warn('Failed to capture page source:', error.message);
            }

            // Get current window info
            let windowInfo = {};
            try {
                windowInfo = await this.driver.getWindowSize();
            } catch (error) {
                console.warn('Failed to get window info:', error.message);
            }

            // Get current app context (platform-specific)
            let appContext = {};
            try {
                if (this.currentPlatform === 'Android') {
                    appContext.currentActivity = await this.driver.getCurrentActivity();
                    appContext.currentPackage = await this.driver.getCurrentPackage();
                } else if (this.currentPlatform === 'iOS') {
                    // For iOS, we can capture orientation and other available info
                    appContext.orientation = await this.driver.getOrientation();
                }
            } catch (error) {
                console.warn('Failed to get app context:', error.message);
            }

            const capture = {
                id: captureId,
                timestamp,
                actionName,
                actionParams,
                platform: this.currentPlatform,
                screenshotPath,
                pageSourcePath,
                windowInfo,
                appContext,
                captureTime: new Date(timestamp).toISOString()
            };

            // Add to recent captures and maintain retention limit
            this.autoStateCapture.lastCaptures.push(capture);
            if (this.autoStateCapture.lastCaptures.length > this.autoStateCapture.retainCount) {
                // Remove oldest captures (but keep files for debugging)
                this.autoStateCapture.lastCaptures.shift();
            }

            return capture;
        } catch (error) {
            console.warn('State capture failed:', error.message);
            return null;
        }
    }

    async getStateCaptureContext() {
        if (!this.autoStateCapture.enabled) {
            return { enabled: false };
        }

        return {
            enabled: true,
            retainCount: this.autoStateCapture.retainCount,
            outputDir: this.autoStateCapture.outputDir,
            captureBeforeActions: this.autoStateCapture.captureBeforeActions,
            recentCapturesCount: this.autoStateCapture.lastCaptures.length,
            lastCaptures: this.autoStateCapture.lastCaptures.map(capture => ({
                id: capture.id,
                timestamp: capture.timestamp,
                actionName: capture.actionName,
                platform: capture.platform,
                hasScreenshot: !!capture.screenshotPath,
                hasPageSource: !!capture.pageSourcePath,
                captureTime: capture.captureTime
            }))
        };
    }

    // Enhanced action methods with automatic state capture
    async performActionWithStateCapture(actionName, actionFunction, args) {
        let preActionCapture = null;
        let postActionCapture = null;
        
        // Capture state before action if configured
        if (this.autoStateCapture.captureBeforeActions.includes(actionName)) {
            console.log(`📸 Capturing state before ${actionName}...`);
            preActionCapture = await this.captureCurrentState(`pre_${actionName}`, args);
        }

        // Perform the actual action
        const result = await actionFunction();

        // Capture state after action (always enabled for step-by-step verification)
        console.log(`📸 Capturing state after ${actionName} for UI assertion...`);
        postActionCapture = await this.captureCurrentState(`post_${actionName}`, args);
        
        // Add a brief delay to ensure UI has settled after action
        await new Promise(resolve => setTimeout(resolve, 500));

        // Prepare capture information for result
        const captureInfo = {
            actionName,
            timestamp: Date.now(),
            captureTime: new Date().toISOString()
        };

        // Initialize page source content variables in the correct scope
        let prePageSourceContent = null;
        let postPageSourceContent = null;

        // Add pre-action capture information if available
        if (preActionCapture) {
            try {
                if (preActionCapture.pageSourcePath) {
                    prePageSourceContent = await fs.readFile(preActionCapture.pageSourcePath, 'utf8');
                }
            } catch (error) {
                console.warn('Could not read pre-action page source:', error.message);
            }

            captureInfo.preActionCapture = {
                id: preActionCapture.id,
                timestamp: preActionCapture.timestamp,
                screenshotPath: preActionCapture.screenshotPath,
                pageSourcePath: preActionCapture.pageSourcePath,
                captureTime: preActionCapture.captureTime,
                pageSource: prePageSourceContent,
                elementCount: prePageSourceContent ? (prePageSourceContent.match(/<[^/][^>]*>/g) || []).length : 0
            };
        }

        // Add post-action capture information (for UI assertion)
        if (postActionCapture) {
            try {
                if (postActionCapture.pageSourcePath) {
                    postPageSourceContent = await fs.readFile(postActionCapture.pageSourcePath, 'utf8');
                }
            } catch (error) {
                console.warn('Could not read post-action page source:', error.message);
            }

            captureInfo.postActionCapture = {
                id: postActionCapture.id,
                timestamp: postActionCapture.timestamp,
                screenshotPath: postActionCapture.screenshotPath,
                pageSourcePath: postActionCapture.pageSourcePath,
                captureTime: postActionCapture.captureTime,
                pageSource: postPageSourceContent,
                elementCount: postPageSourceContent ? (postPageSourceContent.match(/<[^/][^>]*>/g) || []).length : 0,
                uiAssertionReady: true // Flag indicating this capture is for UI assertion
            };
        }

        // Enhance result with comprehensive capture information
        result.stateCapture = captureInfo;
        
        // Create user-friendly message about captures
        const preMsg = preActionCapture ? 
            `Pre-action screenshot: ${preActionCapture.screenshotPath ? 'captured' : 'failed'}` : 
            'Pre-action capture: disabled';
        const postMsg = postActionCapture ? 
            `Post-action screenshot: ${postActionCapture.screenshotPath ? 'captured' : 'failed'}` : 
            'Post-action capture: failed';
        
        result.stateCapture.message = `${actionName} completed. ${preMsg}, ${postMsg}. Ready for UI assertion.`;
        
        // Add screenshot analysis helper
        if (postActionCapture && postActionCapture.screenshotPath) {
            result.stateCapture.uiAssertionInfo = {
                screenshotAvailable: true,
                screenshotPath: postActionCapture.screenshotPath,
                pageSourceAvailable: !!postActionCapture.pageSourcePath,
                recommendedAssertions: this.generateUIAssertionRecommendations(actionName, postPageSourceContent),
                nextStepGuidance: `Screenshot saved for step verification. Review the UI state and proceed with next action or use verify_action_result to validate expected changes.`
            };
        }

        return result;
    }

    // Generate UI assertion recommendations based on action type
    generateUIAssertionRecommendations(actionName, pageSource) {
        const recommendations = [];
        
        switch (actionName) {
            case 'click_element':
            case 'smart_find_and_click':
                recommendations.push(
                    'Verify the target element was successfully clicked',
                    'Check if expected page/screen transition occurred',
                    'Look for loading indicators or progress animations',
                    'Confirm any expected UI changes are visible'
                );
                break;
                
            case 'type_text':
                recommendations.push(
                    'Verify text was successfully entered in the target field',
                    'Check if input validation messages appeared',
                    'Confirm cursor position or field focus',
                    'Look for auto-suggestions or dropdown menus'
                );
                break;
                
            case 'swipe':
                recommendations.push(
                    'Verify scrolling/swiping changed the visible content',
                    'Check if new elements became visible',
                    'Confirm expected elements are now accessible',
                    'Look for scroll indicators or page position changes'
                );
                break;
                
            case 'scroll_to_element':
                recommendations.push(
                    'Verify target element is now visible on screen',
                    'Check if element is properly positioned and accessible',
                    'Confirm scrolling stopped at correct position',
                    'Look for any elements that may be partially obscured'
                );
                break;
                
            default:
                recommendations.push(
                    'Verify the action completed successfully',
                    'Check for any error messages or warnings',
                    'Confirm UI state matches expected outcome',
                    'Look for visual indicators of action completion'
                );
        }
        
        // Add dynamic recommendations based on page content
        if (pageSource) {
            if (pageSource.includes('error') || pageSource.includes('Error')) {
                recommendations.unshift('⚠️ ERROR DETECTED: Check for error messages or dialogs');
            }
            if (pageSource.includes('loading') || pageSource.includes('Loading')) {
                recommendations.push('📋 Loading state detected: Wait for completion before next action');
            }
            if (pageSource.includes('alert') || pageSource.includes('Alert')) {
                recommendations.unshift('🚨 ALERT DETECTED: Handle popup or alert dialog');
            }
        }
        
        return recommendations;
    }

    async handleWaitForElement(args) {
        try {
            await this.ensureConnection();

            const { selector, selectorType = 'xpath', timeout = 10000, expectedCondition = 'visible', pollInterval = 500 } = args;

            console.log(`Waiting for element: ${selector} (${selectorType}) with condition: ${expectedCondition}`);

            const startTime = Date.now();
            let element = null;
            let lastError = null;

            while (Date.now() - startTime < timeout) {
                try {
                    // Find the element
                    element = await this.driver.$(selector);
                    
                    // Check if element exists
                    const exists = await element.isExisting();
                    if (!exists) {
                        throw new Error('Element does not exist');
                    }

                    // Check condition
                    let conditionMet = false;
                    switch (expectedCondition) {
                        case 'visible':
                            conditionMet = await element.isDisplayed();
                            break;
                        case 'present':
                            conditionMet = exists;
                            break;
                        case 'clickable':
                            conditionMet = await element.isClickable();
                            break;
                        default:
                            conditionMet = exists;
                    }

                    if (conditionMet) {
                        return this.createSuccessResponse(
                            `Element found and ${expectedCondition}`,
                            {
                                found: true,
                                condition: expectedCondition,
                                selector,
                                selectorType,
                                waitTime: Date.now() - startTime
                            }
                        );
                    }
                } catch (error) {
                    lastError = error;
                }

                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }

            return this.createErrorResponse('wait_for_element', 
                new Error(`Element not found or condition not met after ${timeout}ms. Last error: ${lastError?.message || 'Unknown'}`));
        } catch (error) {
            return this.createErrorResponse('wait_for_element', error);
        }
    }

    async handleWaitForText(args) {
        try {
            await this.ensureConnection();

            const { text, timeout = 10000, exact = false, pollInterval = 500 } = args;

            console.log(`Waiting for text: "${text}" (exact: ${exact})`);

            const startTime = Date.now();
            let lastError = null;

            while (Date.now() - startTime < timeout) {
                try {
                    const pageSource = await this.driver.getPageSource();
                    
                    const found = exact ? 
                        pageSource.includes(text) : 
                        pageSource.toLowerCase().includes(text.toLowerCase());

                    if (found) {
                        return this.createSuccessResponse(
                            `Text found: "${text}"`,
                            {
                                found: true,
                                text,
                                exact,
                                waitTime: Date.now() - startTime
                            }
                        );
                    }
                } catch (error) {
                    lastError = error;
                }

                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }

            return this.createErrorResponse('wait_for_text', 
                new Error(`Text "${text}" not found after ${timeout}ms. Last error: ${lastError?.message || 'Unknown'}`));
        } catch (error) {
            return this.createErrorResponse('wait_for_text', error);
        }
    }

    async handleScrollToElement(args) {
        try {
            await this.ensureConnection();

            const { 
                strategy = 'xpath', 
                selector, 
                direction = 'up', 
                maxScrolls = 15, 
                scrollDistance = 300,
                detectScrollableContainers = true,
                smartScrollDetection = true,
                waitAfterScroll = 800
            } = args;

            console.log(`🔍 Scrolling to find element: ${selector} (${strategy}) in direction: ${direction}`);

            let scrollCount = 0;
            let element = null;
            let lastPageSource = '';
            let stuckCounter = 0;
            const maxStuckAttempts = 5; // Increased to ensure we reach the actual end

            // First try to find the element without scrolling
            try {
                element = await this.findElementByStrategy(strategy, selector, 1000);
                const displayed = await element.isDisplayed();
                const enabled = await element.isEnabled();
                
                if (displayed && enabled) {
                    console.log(`✅ Element already visible and clickable: ${selector}`);
                    return this.createSuccessResponse(
                        `✅ Element already visible and clickable: ${selector}`,
                        {
                            found: true,
                            selector,
                            strategy,
                            scrollsPerformed: 0,
                            direction,
                            method: 'no_scroll_needed',
                            elementState: { displayed, enabled }
                        }
                    );
                } else if (displayed && !enabled) {
                    console.log(`⚠️ Element visible but not enabled: ${selector} - will try scrolling to find enabled version`);
                } else {
                    console.log(`⚠️ Element found but not displayed: ${selector} - will try scrolling`);
                }
            } catch (error) {
                console.log(`Element not immediately visible, starting scroll search: ${error.message}`);
            }

            // Get window dimensions for scroll calculations
            const windowSize = await this.driver.getWindowSize();
            console.log(`📱 Window size: ${windowSize.width}x${windowSize.height}`);

            // Detect scrollable containers if enabled
            let scrollableArea = null;
            if (detectScrollableContainers) {
                scrollableArea = await this.detectScrollableContainer();
                if (scrollableArea) {
                    console.log(`📜 Found scrollable container: ${scrollableArea.type} at ${scrollableArea.bounds}`);
                }
            }

            // Store initial page source for stuck detection
            if (smartScrollDetection) {
                try {
                    lastPageSource = await this.driver.getPageSource();
                } catch (error) {
                    console.warn(`Could not get initial page source for smart detection: ${error.message}`);
                    // Continue without smart detection
                }
            }

            while (scrollCount < maxScrolls) {
                console.log(`🔄 Scroll attempt ${scrollCount + 1}/${maxScrolls} (direction: ${direction})`);

                // Try to find the element before scrolling
                try {
                    element = await this.findElementByStrategy(strategy, selector, 500);
                    const displayed = await element.isDisplayed();
                    if (displayed) {
                        console.log(`✅ Element found before scroll attempt ${scrollCount + 1}: ${selector}`);
                        return this.createSuccessResponse(
                            `✅ Element found before scroll attempt ${scrollCount + 1}: ${selector}`,
                            {
                                found: true,
                                selector,
                                strategy,
                                scrollsPerformed: scrollCount,
                                direction,
                                method: 'pre_scroll_check'
                            }
                        );
                    }
                } catch (error) {
                    // Element not found yet, continue scrolling
                    console.log(`Element not found before scroll ${scrollCount + 1}, proceeding with scroll...`);
                }

                // Smart scroll detection - check if we're stuck
                if (smartScrollDetection && lastPageSource) {
                    try {
                        const currentPageSource = await this.driver.getPageSource();
                        
                        // Check if page content has changed
                        const contentChanged = currentPageSource !== lastPageSource;
                        
                        if (!contentChanged) {
                            stuckCounter++;
                            console.log(`⚠️ Page content unchanged, stuck counter: ${stuckCounter}/${maxStuckAttempts}`);
                            console.log(`📊 Scroll progress: ${scrollCount}/${maxScrolls} scrolls performed`);
                            
                            if (stuckCounter >= maxStuckAttempts) {
                                console.log(`🛑 Stopping scroll - reached end of scrollable content after ${scrollCount} scrolls`);
                                break;
                            }
                        } else {
                            // Content changed, reset counter and update last page source
                            if (stuckCounter > 0) {
                                console.log(`✅ Page content changed, resetting stuck counter (was ${stuckCounter})`);
                            }
                            stuckCounter = 0;
                            lastPageSource = currentPageSource;
                        }
                    } catch (error) {
                        console.warn(`Could not get page source for stuck detection: ${error.message}`);
                        // Continue scrolling without stuck detection for this iteration
                    }
                }

                // Perform optimized scroll gesture
                try {
                    await this.performOptimizedScroll(direction, scrollDistance, windowSize, scrollableArea);
                    scrollCount++;

                    // Wait for UI to settle after scroll
                    await new Promise(resolve => setTimeout(resolve, waitAfterScroll));

                    // ENHANCED: Check for element visibility immediately after scroll
                    try {
                        element = await this.findElementByStrategy(strategy, selector, 500);
                        const displayed = await element.isDisplayed();
                        const enabled = await element.isEnabled();
                        
                        if (displayed && enabled) {
                            console.log(`✅ Element found and clickable after scroll ${scrollCount}: ${selector}`);
                            return this.createSuccessResponse(
                                `✅ Element found and clickable after scroll ${scrollCount}: ${selector}`,
                                {
                                    found: true,
                                    selector,
                                    strategy,
                                    scrollsPerformed: scrollCount,
                                    direction,
                                    method: 'post_scroll_check',
                                    elementState: { displayed, enabled }
                                }
                            );
                        } else if (displayed && !enabled) {
                            console.log(`⚠️ Element found but not enabled after scroll ${scrollCount}: ${selector} - continuing scroll`);
                        }
                    } catch (postScrollError) {
                        // Element not visible after this scroll, continue to next iteration
                        console.log(`Element not found after scroll ${scrollCount}, continuing...`);
                    }

                } catch (scrollError) {
                    console.error(`Scroll attempt ${scrollCount + 1} failed: ${scrollError.message}`);
                    scrollCount++;
                    // Continue to try remaining scroll attempts
                    if (scrollCount >= maxScrolls) {
                        break;
                    }
                    // Wait a bit before retrying
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            // Try one final search after all scrolls
            try {
                element = await this.findElementByStrategy(strategy, selector, 2000);
                const displayed = await element.isDisplayed();
                if (displayed) {
                    return this.createSuccessResponse(
                        `✅ Element found in final search: ${selector}`,
                        {
                            found: true,
                            selector,
                            strategy,
                            scrollsPerformed: scrollCount,
                            direction,
                            method: 'final_search'
                        }
                    );
                }
            } catch (error) {
                // Final search failed
            }

            const failureReason = stuckCounter >= maxStuckAttempts ? 
                'Reached end of scrollable content' : 
                'Max scroll attempts reached';

            return this.createErrorResponse('scroll_to_element', 
                new Error(`❌ Element not found after ${scrollCount} scroll attempts: ${selector}. Reason: ${failureReason}`));
        } catch (error) {
            return this.createErrorResponse('scroll_to_element', error);
        }
    }

    async detectScrollableContainer() {
        try {
            const pageSource = await this.driver.getPageSource();
            
            // Look for common scrollable containers with priority order
            const scrollablePatterns = [
                // iOS scrollable elements (higher priority first)
                { pattern: 'XCUIElementTypeScrollView', priority: 1 },
                { pattern: 'XCUIElementTypeTableView', priority: 2 },
                { pattern: 'XCUIElementTypeCollectionView', priority: 3 },
                { pattern: 'UIScrollView', priority: 4 },
                { pattern: 'UITableView', priority: 5 },
                { pattern: 'UICollectionView', priority: 6 },
                
                // Android scrollable elements
                { pattern: 'androidx.recyclerview.widget.RecyclerView', priority: 1 },
                { pattern: 'android.support.v7.widget.RecyclerView', priority: 2 },
                { pattern: 'androidx.core.widget.NestedScrollView', priority: 3 },
                { pattern: 'android.widget.ScrollView', priority: 4 },
                { pattern: 'android.widget.ListView', priority: 5 },
                { pattern: 'ScrollView', priority: 6 },
                { pattern: 'RecyclerView', priority: 7 },
                { pattern: 'ListView', priority: 8 }
            ];

            let bestMatch = null;
            let bestPriority = Infinity;

            for (const { pattern, priority } of scrollablePatterns) {
                // Look for elements with scrollable attributes
                const scrollableRegex = new RegExp(
                    `<[^>]*${pattern}[^>]*(?:scrollable="true"|scrollable="1"|class="[^"]*scrollable[^"]*")[^>]*([^>]*)>`, 
                    'gi'
                );
                
                // Also look for basic pattern matches
                const basicRegex = new RegExp(`<[^>]*${pattern}[^>]*([^>]*)>`, 'i');
                
                let match = pageSource.match(scrollableRegex) || pageSource.match(basicRegex);
                if (match && priority < bestPriority) {
                    const elementMatch = match[0];
                    
                    // Extract bounds if available
                    const boundsMatch = elementMatch.match(/bounds="([^"]+)"/);
                    const rectMatch = elementMatch.match(/x="(\d+)"[^>]*y="(\d+)"[^>]*width="(\d+)"[^>]*height="(\d+)"/);
                    
                    let bounds = null;
                    if (boundsMatch) {
                        bounds = boundsMatch[1];
                    } else if (rectMatch) {
                        // Convert x,y,width,height to bounds format
                        const x = parseInt(rectMatch[1]);
                        const y = parseInt(rectMatch[2]);
                        const width = parseInt(rectMatch[3]);
                        const height = parseInt(rectMatch[4]);
                        bounds = `[${x},${y}][${x + width},${y + height}]`;
                    }
                    
                    // Extract element ID or accessibility info for iOS mobile commands
                    const idMatch = elementMatch.match(/(?:id|name|accessibility-id)="([^"]+)"/);
                    const elementId = idMatch ? idMatch[1] : null;
                    
                    bestMatch = {
                        type: pattern,
                        bounds: bounds,
                        element: elementMatch,
                        elementId: elementId,
                        priority: priority,
                        isScrollable: scrollableRegex.test(elementMatch)
                    };
                    bestPriority = priority;
                }
            }

            if (bestMatch) {
                console.log(`📜 Found scrollable container: ${bestMatch.type} (priority: ${bestMatch.priority}, scrollable: ${bestMatch.isScrollable})`);
                return bestMatch;
            }

            // Fallback: look for any element with scrollable="true"
            const fallbackRegex = /<[^>]*scrollable="true"[^>]*([^>]*)>/i;
            const fallbackMatch = pageSource.match(fallbackRegex);
            if (fallbackMatch) {
                console.log(`📜 Found fallback scrollable element`);
                const boundsMatch = fallbackMatch[0].match(/bounds="([^"]+)"/);
                return {
                    type: 'generic_scrollable',
                    bounds: boundsMatch ? boundsMatch[1] : null,
                    element: fallbackMatch[0],
                    elementId: null,
                    priority: 999,
                    isScrollable: true
                };
            }

        } catch (error) {
            console.warn('Could not detect scrollable container:', error.message);
        }
        return null;
    }

    async performOptimizedScroll(direction, scrollDistance, windowSize, scrollableArea) {
        const centerX = Math.floor(windowSize.width / 2);
        const centerY = Math.floor(windowSize.height / 2);
        
        // Use scrollable area bounds if available, otherwise use window center
        let baseX = centerX;
        let baseY = centerY;
        let containerBounds = null;
        
        if (scrollableArea && scrollableArea.bounds) {
            try {
                // Parse bounds format like "[x,y][x2,y2]"
                const boundsMatch = scrollableArea.bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
                if (boundsMatch) {
                    const x1 = parseInt(boundsMatch[1]);
                    const y1 = parseInt(boundsMatch[2]);
                    const x2 = parseInt(boundsMatch[3]);
                    const y2 = parseInt(boundsMatch[4]);
                    baseX = Math.floor((x1 + x2) / 2);
                    baseY = Math.floor((y1 + y2) / 2);
                    containerBounds = { x1, y1, x2, y2, width: x2 - x1, height: y2 - y1 };
                    console.log(`📍 Using scrollable area center: (${baseX}, ${baseY}), bounds: ${containerBounds.width}x${containerBounds.height}`);
                }
            } catch (error) {
                console.warn('Could not parse scrollable area bounds, using window center');
            }
        }

        let startX = baseX, startY = baseY, endX = baseX, endY = baseY;

        // Calculate optimized scroll coordinates with larger distances
        const scrollFactor = 0.6; // Scroll 60% of screen/container
        const effectiveWidth = containerBounds ? containerBounds.width : windowSize.width;
        const effectiveHeight = containerBounds ? containerBounds.height : windowSize.height;
        const maxDistance = Math.max(scrollDistance, Math.min(effectiveWidth, effectiveHeight) * scrollFactor);

        // Add safe margins to prevent scroll coordinates from going outside bounds
        const safeMarginX = Math.floor(effectiveWidth * 0.05); // 5% margin
        const safeMarginY = Math.floor(effectiveHeight * 0.05); // 5% margin

        switch (direction.toLowerCase()) {
            case 'down':
                // Swipe UP to scroll DOWN (show content below) - finger moves from bottom to top
                startY = Math.min(baseY + Math.floor(maxDistance / 3), (containerBounds ? containerBounds.y2 : windowSize.height) - safeMarginY);
                endY = Math.max(baseY - Math.floor(maxDistance / 2), (containerBounds ? containerBounds.y1 : 0) + safeMarginY);
                break;
            case 'up':
                // Swipe DOWN to scroll UP (show content above) - finger moves from top to bottom
                startY = Math.max(baseY - Math.floor(maxDistance / 3), (containerBounds ? containerBounds.y1 : 0) + safeMarginY);
                endY = Math.min(baseY + Math.floor(maxDistance / 2), (containerBounds ? containerBounds.y2 : windowSize.height) - safeMarginY);
                break;
            case 'left':
                startX = Math.min(baseX + Math.floor(maxDistance / 3), (containerBounds ? containerBounds.x2 : windowSize.width) - safeMarginX);
                endX = Math.max(baseX - Math.floor(maxDistance / 2), (containerBounds ? containerBounds.x1 : 0) + safeMarginX);
                break;
            case 'right':
                startX = Math.max(baseX - Math.floor(maxDistance / 3), (containerBounds ? containerBounds.x1 : 0) + safeMarginX);
                endX = Math.min(baseX + Math.floor(maxDistance / 2), (containerBounds ? containerBounds.x2 : windowSize.width) - safeMarginX);
                break;
        }

        console.log(`👆 Scrolling ${direction} from (${startX}, ${startY}) to (${endX}, ${endY}) [distance: ${Math.floor(Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)))}px]`);

        try {
            // Perform platform-specific scroll
            if (this.currentPlatform === 'iOS') {
                // Use iOS-specific mobile commands for better reliability
                try {
                    if (scrollableArea && scrollableArea.element) {
                        // Try element-specific scroll first
                        await this.driver.execute('mobile: scroll', {
                            direction: direction,
                            element: scrollableArea.element,
                            distance: Math.floor(maxDistance * 0.8) // Slightly smaller distance for element scroll
                        });
                    } else {
                        // Fallback to swipe gesture for iOS
                        await this.driver.execute('mobile: swipe', {
                            startX: startX,
                            startY: startY,
                            endX: endX,
                            endY: endY,
                            duration: 0.8 // 800ms duration
                        });
                    }
                } catch (iosScrollError) {
                    console.warn(`iOS scroll command failed, using touch actions: ${iosScrollError.message}`);
                    // Fallback to touch actions for iOS
                    await this.driver.performActions([{
                        type: 'pointer',
                        id: 'finger1',
                        parameters: { pointerType: 'touch' },
                        actions: [
                            { type: 'pointerMove', duration: 0, x: startX, y: startY },
                            { type: 'pointerDown', button: 0 },
                            { type: 'pause', duration: 100 },
                            { type: 'pointerMove', duration: 800, x: endX, y: endY },
                            { type: 'pointerUp', button: 0 }
                        ]
                    }]);
                    await this.driver.releaseActions();
                }
            } else {
                // Use touch actions for Android
                await this.driver.performActions([{
                    type: 'pointer',
                    id: 'finger1',
                    parameters: { pointerType: 'touch' },
                    actions: [
                        { type: 'pointerMove', duration: 0, x: startX, y: startY },
                        { type: 'pointerDown', button: 0 },
                        { type: 'pause', duration: 100 },
                        { type: 'pointerMove', duration: 800, x: endX, y: endY },
                        { type: 'pointerUp', button: 0 }
                    ]
                }]);

                await this.driver.releaseActions();
            }
        } catch (scrollError) {
            console.error(`Scroll gesture failed: ${scrollError.message}`);
            // Final fallback - use basic swipe
            try {
                await this.driver.performTouchAction([
                    { action: 'press', x: startX, y: startY },
                    { action: 'wait', ms: 100 },
                    { action: 'moveTo', x: endX, y: endY },
                    { action: 'release' }
                ]);
            } catch (fallbackError) {
                console.error(`Fallback scroll also failed: ${fallbackError.message}`);
                throw new Error(`All scroll methods failed: ${scrollError.message}`);
            }
        }
    }

    async handleVerifyActionResult(args) {
        try {
            await this.ensureConnection();

            const { 
                verification, 
                timeout = 5000, 
                waitAfterAction = 1000,
                enableScrolling = false,
                maxScrollAttempts = 3
            } = args;

            // Handle legacy format for backward compatibility
            const { expectedText, expectedElement } = args;
            
            // Validate that at least one verification parameter is provided
            if (!verification && !expectedText && !expectedElement) {
                throw new Error('At least one verification parameter must be provided: verification, expectedText, or expectedElement');
            }
            
            console.log(`🔍 Verifying action result...`);

            const startTime = Date.now();

            // Wait for UI to update after action
            if (waitAfterAction > 0) {
                await new Promise(resolve => setTimeout(resolve, waitAfterAction));
            }

            const results = {
                verified: false,
                checks: [],
                methods: []
            };

            // Handle new verification format
            if (verification) {
                const result = await this.performSmartVerification(verification, timeout, enableScrolling, maxScrollAttempts);
                results.checks.push(result);
                if (result.success) {
                    results.verified = true;
                }
            }

            // Handle legacy format for backward compatibility
            if (expectedText) {
                const textResult = await this.verifyTextPresence(expectedText, timeout);
                results.checks.push(textResult);
                if (textResult.success) {
                    results.verified = true;
                }
            }

            if (expectedElement) {
                const elementResult = await this.verifyElementPresence(expectedElement, timeout, enableScrolling, maxScrollAttempts);
                results.checks.push(elementResult);
                if (elementResult.success) {
                    results.verified = true;
                }
            }

            results.verificationTime = Date.now() - startTime;

            const message = results.verified ? 
                '✅ Action result verified successfully' : 
                '❌ Action result verification failed';

            return this.createSuccessResponse(message, results);
        } catch (error) {
            return this.createErrorResponse('verify_action_result', error);
        }
    }

    // Enhanced verification method with smart element finding
    async performSmartVerification(verification, timeout, enableScrolling, maxScrollAttempts) {
        const { type, strategy, selector } = verification;
        const startTime = Date.now();
        
        console.log(`🔍 Smart verification: ${type} for ${strategy}:${selector}`);

        const result = {
            type: 'smart_verification',
            verificationType: type,
            strategy,
            selector,
            success: false,
            methods: [],
            details: {}
        };

        try {
            switch (type) {
                case 'element_visible':
                    result.success = await this.smartVerifyElementVisible(strategy, selector, timeout, enableScrolling, maxScrollAttempts, result);
                    break;
                
                case 'element_hidden':
                    result.success = await this.smartVerifyElementHidden(strategy, selector, timeout, result);
                    break;
                
                case 'text_present':
                    result.success = await this.smartVerifyTextPresent(selector, timeout, enableScrolling, maxScrollAttempts, result);
                    break;
                
                case 'text_absent':
                    result.success = await this.smartVerifyTextAbsent(selector, timeout, result);
                    break;
                
                case 'element_enabled':
                    result.success = await this.smartVerifyElementEnabled(strategy, selector, timeout, enableScrolling, maxScrollAttempts, result);
                    break;
                
                case 'element_disabled':
                    result.success = await this.smartVerifyElementDisabled(strategy, selector, timeout, enableScrolling, maxScrollAttempts, result);
                    break;
                
                default:
                    throw new Error(`Unsupported verification type: ${type}`);
            }

            result.verificationTime = Date.now() - startTime;
            
        } catch (error) {
            result.error = error.message;
            result.methods.push({
                method: 'error',
                success: false,
                error: error.message
            });
        }

        return result;
    }

    // Smart element visibility verification with fallback strategies
    async smartVerifyElementVisible(strategy, selector, timeout, enableScrolling, maxScrollAttempts, result) {
        const methods = result.methods;

        // Method 1: Direct element finding with current strategy
        try {
            const element = await this.findElementByStrategy(strategy, selector, Math.min(timeout, 3000));
            const isDisplayed = await element.isDisplayed();
            const isEnabled = await element.isEnabled();
            
            methods.push({
                method: 'direct_find',
                success: isDisplayed,
                details: { found: true, displayed: isDisplayed, enabled: isEnabled }
            });

            if (isDisplayed) {
                result.details = { found: true, displayed: true, enabled: isEnabled };
                return true;
            }
        } catch (error) {
            methods.push({
                method: 'direct_find',
                success: false,
                error: error.message
            });
        }

        // Method 2: Try alternative strategies (similar to smart_find_and_click)
        if (strategy !== 'accessibilityId') {
            try {
                const pageSource = await this.driver.getPageSource();
                const elements = await this.extractElementsFromPageSource(pageSource);
                
                // Find elements that might match our selector
                const matchingElements = elements.filter(el => 
                    this.elementMatchesSelector(el, strategy, selector)
                );

                if (matchingElements.length > 0) {
                    // Try finding with alternative strategies
                    for (const el of matchingElements.slice(0, 3)) { // Try up to 3 matches
                        if (el.strategy && el.strategy !== strategy) {
                            try {
                                const altElement = await this.findElementByStrategy(el.strategy, el.selector, 2000);
                                const isDisplayed = await altElement.isDisplayed();
                                
                                methods.push({
                                    method: 'alternative_strategy',
                                    strategy: el.strategy,
                                    selector: el.selector,
                                    success: isDisplayed,
                                    details: { displayed: isDisplayed }
                                });

                                if (isDisplayed) {
                                    result.details = { found: true, displayed: true, alternativeStrategy: el.strategy };
                                    return true;
                                }
                            } catch (altError) {
                                methods.push({
                                    method: 'alternative_strategy',
                                    strategy: el.strategy,
                                    selector: el.selector,
                                    success: false,
                                    error: altError.message
                                });
                            }
                        }
                    }
                }
            } catch (error) {
                methods.push({
                    method: 'alternative_strategy',
                    success: false,
                    error: error.message
                });
            }
        }

        // Method 3: Scrolling to find element (if enabled)
        if (enableScrolling) {
            try {
                const scrollResult = await this.handleScrollToElement({
                    strategy,
                    selector,
                    direction: 'down',
                    maxScrolls: maxScrollAttempts,
                    scrollDistance: 300
                });

                if (scrollResult && !scrollResult.isError) {
                    methods.push({
                        method: 'scroll_find',
                        success: true,
                        details: { scrollsPerformed: scrollResult.content.scrollsPerformed }
                    });

                    result.details = { found: true, displayed: true, foundViaScrolling: true };
                    return true;
                } else {
                    methods.push({
                        method: 'scroll_find',
                        success: false,
                        error: scrollResult?.message || 'Scroll failed'
                    });
                }
            } catch (scrollError) {
                methods.push({
                    method: 'scroll_find',
                    success: false,
                    error: scrollError.message
                });
            }
        }

        // Method 4: Page source text search as final fallback
        try {
            const pageSource = await this.driver.getPageSource();
            const selectorInSource = pageSource.includes(selector);
            
            methods.push({
                method: 'page_source_search',
                success: selectorInSource,
                details: { foundInSource: selectorInSource }
            });

            if (selectorInSource) {
                result.details = { foundInPageSource: true, actuallyVisible: false };
                return false; // Present in source but not actually visible
            }
        } catch (error) {
            methods.push({
                method: 'page_source_search',
                success: false,
                error: error.message
            });
        }

        result.details = { found: false, displayed: false };
        return false;
    }

    // Smart element enabled/disabled verification
    async smartVerifyElementEnabled(strategy, selector, timeout, enableScrolling, maxScrollAttempts, result) {
        const methods = result.methods;

        // Try to find element first (similar to visibility check)
        try {
            const element = await this.findElementByStrategy(strategy, selector, Math.min(timeout, 3000));
            const isEnabled = await element.isEnabled();
            const isDisplayed = await element.isDisplayed();
            
            methods.push({
                method: 'direct_find',
                success: isEnabled,
                details: { found: true, enabled: isEnabled, displayed: isDisplayed }
            });

            result.details = { found: true, enabled: isEnabled, displayed: isDisplayed };
            return isEnabled;
        } catch (error) {
            methods.push({
                method: 'direct_find',
                success: false,
                error: error.message
            });

            // If scrolling enabled, try to find via scroll
            if (enableScrolling) {
                try {
                    const scrollResult = await this.handleScrollToElement({
                        strategy,
                        selector,
                        direction: 'down',
                        maxScrolls: maxScrollAttempts
                    });

                    if (scrollResult && !scrollResult.isError) {
                        const element = await this.findElementByStrategy(strategy, selector, 2000);
                        const isEnabled = await element.isEnabled();
                        
                        methods.push({
                            method: 'scroll_and_check',
                            success: isEnabled,
                            details: { enabled: isEnabled, foundViaScrolling: true }
                        });

                        result.details = { found: true, enabled: isEnabled, foundViaScrolling: true };
                        return isEnabled;
                    }
                } catch (scrollError) {
                    methods.push({
                        method: 'scroll_and_check',
                        success: false,
                        error: scrollError.message
                    });
                }
            }

            result.details = { found: false, enabled: false };
            return false;
        }
    }

    // Smart element disabled verification
    async smartVerifyElementDisabled(strategy, selector, timeout, enableScrolling, maxScrollAttempts, result) {
        // Element is disabled if it exists but is not enabled
        const enabledResult = await this.smartVerifyElementEnabled(strategy, selector, timeout, enableScrolling, maxScrollAttempts, result);
        
        // If element wasn't found, that's different from being disabled
        if (!result.details.found) {
            result.details.disabled = false;
            result.details.reason = 'element_not_found';
            return false;
        }

        const isDisabled = !enabledResult;
        result.details.disabled = isDisabled;
        return isDisabled;
    }

    // Smart element hidden verification
    async smartVerifyElementHidden(strategy, selector, timeout, result) {
        const methods = result.methods;

        try {
            const element = await this.findElementByStrategy(strategy, selector, Math.min(timeout, 3000));
            const isDisplayed = await element.isDisplayed();
            
            methods.push({
                method: 'direct_find',
                success: !isDisplayed, // Success means element is hidden
                details: { found: true, displayed: isDisplayed, hidden: !isDisplayed }
            });

            result.details = { found: true, displayed: isDisplayed, hidden: !isDisplayed };
            return !isDisplayed; // Return true if element is hidden
        } catch (error) {
            // If element not found at all, it's effectively hidden
            methods.push({
                method: 'direct_find',
                success: true, // Not found = hidden
                details: { found: false, hidden: true, reason: 'not_found' }
            });

            result.details = { found: false, hidden: true, reason: 'element_not_found' };
            return true;
        }
    }

    // Smart text presence verification with scrolling
    async smartVerifyTextPresent(text, timeout, enableScrolling, maxScrollAttempts, result) {
        const methods = result.methods;

        // Method 1: Direct page source search
        try {
            const pageSource = await this.driver.getPageSource();
            const textFound = pageSource.toLowerCase().includes(text.toLowerCase());
            
            methods.push({
                method: 'page_source_search',
                success: textFound,
                details: { textFound }
            });

            if (textFound) {
                result.details = { found: true, method: 'direct_search' };
                return true;
            }
        } catch (error) {
            methods.push({
                method: 'page_source_search',
                success: false,
                error: error.message
            });
        }

        // Method 2: Try scrolling to find text (if enabled)
        if (enableScrolling) {
            try {
                // Try scrolling down to find text
                for (let i = 0; i < maxScrollAttempts; i++) {
                    await this.performOptimizedScroll('down', 300);
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    const pageSource = await this.driver.getPageSource();
                    const textFound = pageSource.toLowerCase().includes(text.toLowerCase());
                    
                    if (textFound) {
                        methods.push({
                            method: 'scroll_search',
                            success: true,
                            details: { textFound: true, scrollsPerformed: i + 1 }
                        });

                        result.details = { found: true, foundViaScrolling: true, scrollsPerformed: i + 1 };
                        return true;
                    }
                }

                methods.push({
                    method: 'scroll_search',
                    success: false,
                    details: { textFound: false, scrollsPerformed: maxScrollAttempts }
                });
            } catch (scrollError) {
                methods.push({
                    method: 'scroll_search',
                    success: false,
                    error: scrollError.message
                });
            }
        }

        result.details = { found: false };
        return false;
    }

    // Smart text absence verification
    async smartVerifyTextAbsent(text, timeout, result) {
        const methods = result.methods;

        try {
            const pageSource = await this.driver.getPageSource();
            const textFound = pageSource.toLowerCase().includes(text.toLowerCase());
            
            methods.push({
                method: 'page_source_search',
                success: !textFound, // Success means text is absent
                details: { textFound, absent: !textFound }
            });

            result.details = { found: textFound, absent: !textFound };
            return !textFound;
        } catch (error) {
            methods.push({
                method: 'page_source_search',
                success: false,
                error: error.message
            });

            result.details = { error: error.message };
            return false;
        }
    }

    // Helper function to check if element matches selector
    elementMatchesSelector(element, strategy, selector) {
        switch (strategy) {
            case 'id':
                return element.resourceId && element.resourceId.includes(selector);
            case 'text':
                return element.text && element.text.includes(selector);
            case 'contentDescription':
                return element.contentDesc && element.contentDesc.includes(selector);
            case 'accessibilityId':
                return element.accessibilityId && element.accessibilityId.includes(selector);
            case 'className':
                return element.className && element.className.includes(selector);
            default:
                return false;
        }
    }

    // Legacy text verification method for backward compatibility
    async verifyTextPresence(expectedText, timeout) {
        try {
            const pageSource = await this.driver.getPageSource();
            const textFound = pageSource.toLowerCase().includes(expectedText.toLowerCase());
            
            return {
                type: 'text',
                expected: expectedText,
                success: textFound,
                method: 'legacy'
            };
        } catch (error) {
            return {
                type: 'text',
                expected: expectedText,
                success: false,
                error: error.message,
                method: 'legacy'
            };
        }
    }

    // Legacy element verification method for backward compatibility
    async verifyElementPresence(expectedElement, timeout, enableScrolling, maxScrollAttempts) {
        try {
            // Use smart verification for better results
            const verification = {
                type: 'element_visible',
                strategy: 'xpath', // Default to xpath for legacy selectors
                selector: expectedElement
            };

            return await this.performSmartVerification(verification, timeout, enableScrolling, maxScrollAttempts);
        } catch (error) {
            return {
                type: 'element',
                selector: expectedElement,
                success: false,
                error: error.message,
                method: 'legacy'
            };
        }
    }

    async handleSmartWait(args) {
        try {
            await this.ensureConnection();

            const { 
                conditions = [], 
                timeout = 10000, 
                pollInterval = 500,
                waitForStability = true,
                stabilityDuration = 1000
            } = args;

            console.log(`Smart wait with ${conditions.length} conditions...`);

            const startTime = Date.now();
            let lastStableTime = null;

            while (Date.now() - startTime < timeout) {
                let allConditionsMet = true;
                const results = [];

                for (const condition of conditions) {
                    const result = { condition, met: false };

                    try {
                        switch (condition.type) {
                            case 'element_visible':
                                const element = await this.driver.$(condition.selector);
                                const exists = await element.isExisting();
                                const visible = exists ? await element.isDisplayed() : false;
                                result.met = visible;
                                result.details = { exists, visible };
                                break;

                            case 'text_present':
                                const pageSource = await this.driver.getPageSource();
                                const textFound = condition.exact ? 
                                    pageSource.includes(condition.text) : 
                                    pageSource.toLowerCase().includes(condition.text.toLowerCase());
                                result.met = textFound;
                                result.details = { textFound };
                                break;

                            case 'element_clickable':
                                const clickableElement = await this.driver.$(condition.selector);
                                const clickable = await clickableElement.isClickable();
                                result.met = clickable;
                                result.details = { clickable };
                                break;

                            case 'loading_complete':
                                // Check for common loading indicators
                                const loadingSelectors = condition.loadingSelectors || [
                                    '//*[contains(@class, "loading")]',
                                    '//*[contains(@class, "spinner")]',
                                    '//*[contains(@text, "Loading")]'
                                ];
                                
                                let loadingFound = false;
                                for (const selector of loadingSelectors) {
                                    try {
                                        const loadingElement = await this.driver.$(selector);
                                        const loadingExists = await loadingElement.isExisting();
                                        const loadingVisible = loadingExists ? await loadingElement.isDisplayed() : false;
                                        if (loadingVisible) {
                                            loadingFound = true;
                                            break;
                                        }
                                    } catch (e) {
                                        // Continue checking other selectors
                                    }
                                }
                                result.met = !loadingFound;
                                result.details = { loadingFound };
                                break;

                            default:
                                result.met = false;
                                result.error = `Unknown condition type: ${condition.type}`;
                        }
                    } catch (error) {
                        result.met = false;
                        result.error = error.message;
                    }

                    results.push(result);
                    
                    if (!result.met) {
                        allConditionsMet = false;
                    }
                }

                if (allConditionsMet) {
                    if (waitForStability) {
                        if (!lastStableTime) {
                            lastStableTime = Date.now();
                        } else if (Date.now() - lastStableTime >= stabilityDuration) {
                            return this.createSuccessResponse(
                                'All conditions met and stable',
                                {
                                    conditionsMet: true,
                                    stable: true,
                                    waitTime: Date.now() - startTime,
                                    stabilityTime: stabilityDuration,
                                    results
                                }
                            );
                        }
                    } else {
                        return this.createSuccessResponse(
                            'All conditions met',
                            {
                                conditionsMet: true,
                                waitTime: Date.now() - startTime,
                                results
                            }
                        );
                    }
                } else {
                    lastStableTime = null;
                }

                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }

            return this.createErrorResponse('smart_wait', 
                new Error(`Smart wait timeout after ${timeout}ms. Not all conditions were met.`));
        } catch (error) {
            return this.createErrorResponse('smart_wait', error);
        }
    }

    async handleCaptureState(args) {
        try {
            await this.ensureConnection();

            const { actionName = 'manual_capture', getContext = true } = args;

            // Capture current state
            const capture = await this.captureCurrentState(actionName, args);
            
            const result = {
                capturePerformed: !!capture,
                actionName,
            };

            if (capture) {
                // Read the actual page source content to include in response
                let pageSourceContent = null;
                let screenshotBase64 = null;
                
                try {
                    if (capture.pageSourcePath) {
                        pageSourceContent = await fs.readFile(capture.pageSourcePath, 'utf8');
                    }
                } catch (error) {
                    console.warn('Could not read page source file:', error.message);
                }

                try {
                    if (capture.screenshotPath) {
                        screenshotBase64 = await fs.readFile(capture.screenshotPath, 'base64');
                    }
                } catch (error) {
                    console.warn('Could not read screenshot file:', error.message);
                }

                result.capture = {
                    id: capture.id,
                    timestamp: capture.timestamp,
                    screenshotPath: capture.screenshotPath,
                    pageSourcePath: capture.pageSourcePath,
                    platform: capture.platform,
                    windowInfo: capture.windowInfo,
                    appContext: capture.appContext,
                    captureTime: capture.captureTime,
                    // Include actual content for immediate analysis
                    pageSource: pageSourceContent,
                    screenshotBase64: screenshotBase64 ? `data:image/png;base64,${screenshotBase64}` : null,
                    elementCount: pageSourceContent ? (pageSourceContent.match(/<[^/][^>]*>/g) || []).length : 0
                };
            }

            // Include context if requested
            if (getContext) {
                result.stateConfiguration = await this.getStateCaptureContext();
            }

            return this.createSuccessResponse(
                capture ? 
                    `State captured successfully: ${capture.id} (${result.capture.elementCount} elements found)` : 
                    'State capture is disabled or failed',
                result
            );
        } catch (error) {
            return this.createErrorResponse('capture_state', error);
        }
    }

    // AI-powered screenshot analysis methods
    async analyzeScreenshotForElement(screenshotPath, targetDescription, options = {}) {
        try {
            // Read screenshot
            const screenshotBuffer = await fs.readFile(screenshotPath);
            const screenshotBase64 = screenshotBuffer.toString('base64');
            
            // Get current window size for coordinate conversion
            const windowSize = await this.driver.getWindowSize();
            
            // Basic pattern matching for common UI elements
            const analysis = await this.performBasicScreenshotAnalysis(
                screenshotBase64, 
                targetDescription, 
                windowSize,
                options
            );
            
            return analysis;
        } catch (error) {
            console.warn('Screenshot analysis failed:', error.message);
            return null;
        }
    }

    async performBasicScreenshotAnalysis(screenshotBase64, targetDescription, windowSize, options = {}) {
        // This is a simplified implementation. In a real scenario, you might use:
        // - Google Vision API for text detection
        // - OpenCV for image processing
        // - ML models for UI element classification
        
        const analysis = {
            windowSize,
            suggestions: [],
            confidence: 0,
            method: 'basic_pattern_matching'
        };

        try {
            // If we have page source, try to correlate with screenshot
            const pageSource = await this.driver.getPageSource();
            const elements = await this.extractElementsFromPageSource(pageSource);
            
            // Find elements that match the target description
            const matchingElements = elements.filter(el => 
                this.matchesDescription(el, targetDescription, options.textToFind)
            );

            if (matchingElements.length > 0) {
                // Try to get actual coordinates for matching elements
                for (const element of matchingElements) {
                    try {
                        const webElement = await this.findElementByStrategy(
                            element.strategy, 
                            element.selector, 
                            1000
                        );
                        
                        const location = await webElement.getLocation();
                        const size = await webElement.getSize();
                        
                        analysis.suggestions.push({
                            description: `${element.text || element.contentDesc || element.resourceId}`,
                            coordinates: {
                                x: location.x + (size.width / 2),
                                y: location.y + (size.height / 2),
                                absoluteX: location.x + (size.width / 2),
                                absoluteY: location.y + (size.height / 2),
                                relativeX: (location.x + (size.width / 2)) / windowSize.width,
                                relativeY: (location.y + (size.height / 2)) / windowSize.height
                            },
                            bounds: {
                                x: location.x,
                                y: location.y,
                                width: size.width,
                                height: size.height
                            },
                            confidence: this.calculateConfidence(element, targetDescription, options.textToFind),
                            element: element,
                            method: 'page_source_correlation'
                        });
                    } catch (error) {
                        // Element might not be accessible, continue with others
                    }
                }
            }

            // If no direct matches, try heuristic positioning
            if (analysis.suggestions.length === 0) {
                analysis.suggestions = await this.generateHeuristicSuggestions(
                    targetDescription, 
                    windowSize, 
                    options
                );
            }

            // Sort by confidence
            analysis.suggestions.sort((a, b) => b.confidence - a.confidence);
            analysis.confidence = analysis.suggestions.length > 0 ? analysis.suggestions[0].confidence : 0;

        } catch (error) {
            console.warn('Page source correlation failed:', error.message);
        }

        return analysis;
    }

    async extractElementsFromPageSource(pageSource) {
        const elements = [];
        
        // Parse XML and extract relevant elements
        const elementRegex = /<([^>]+)([^>]*?)(?:\/>|>[^<]*<\/[^>]+>)/g;
        let match;

        while ((match = elementRegex.exec(pageSource)) !== null) {
            const tag = match[1];
            const attributes = match[2];
            
            // Extract key attributes
            const element = {
                tag,
                resourceId: this.extractAttribute(attributes, 'resource-id'),
                contentDesc: this.extractAttribute(attributes, 'content-desc'),
                text: this.extractAttribute(attributes, 'text'),
                className: this.extractAttribute(attributes, 'class'),
                bounds: this.extractAttribute(attributes, 'bounds'),
                clickable: this.extractAttribute(attributes, 'clickable') === 'true',
                enabled: this.extractAttribute(attributes, 'enabled') === 'true',
                // Extract accessibility ID attributes (iOS: name, label; Android: content-desc can also be accessibility ID)
                name: this.extractAttribute(attributes, 'name'),
                label: this.extractAttribute(attributes, 'label'),
                accessibilityId: this.extractAttribute(attributes, 'accessibility-id') || 
                                this.extractAttribute(attributes, 'name') || 
                                this.extractAttribute(attributes, 'label')
            };

            // Determine best strategy for finding this element - PRIORITIZE accessibilityId first
            if (element.accessibilityId) {
                element.strategy = 'accessibilityId';
                element.selector = element.accessibilityId;
            } else if (element.resourceId) {
                element.strategy = 'id';
                element.selector = element.resourceId;
            } else if (element.contentDesc) {
                element.strategy = 'contentDescription';
                element.selector = element.contentDesc;
            } else if (element.text && element.text.trim()) {
                element.strategy = 'text';
                element.selector = element.text;
            } else {
                element.strategy = 'xpath';
                element.selector = `//*[@class="${element.className}"]`;
            }

            elements.push(element);
        }

        return elements;
    }

    extractAttribute(attributeString, attributeName) {
        const regex = new RegExp(`${attributeName}="([^"]*)"`, 'i');
        const match = attributeString.match(regex);
        return match ? match[1] : null;
    }

    matchesDescription(element, targetDescription, textToFind) {
        const description = targetDescription.toLowerCase();
        const text = textToFind ? textToFind.toLowerCase() : '';
        
        // Check text content
        if (textToFind && element.text && element.text.toLowerCase().includes(text)) {
            return true;
        }
        
        if (textToFind && element.contentDesc && element.contentDesc.toLowerCase().includes(text)) {
            return true;
        }

        // Check by description keywords
        const elementText = (element.text || '').toLowerCase();
        const elementDesc = (element.contentDesc || '').toLowerCase();
        const elementId = (element.resourceId || '').toLowerCase();

        if (description.includes('button') && (
            element.tag.includes('Button') || 
            elementText.includes('button') ||
            elementDesc.includes('button') ||
            elementId.includes('btn')
        )) {
            return true;
        }

        if (description.includes('login') && (
            elementText.includes('login') ||
            elementDesc.includes('login') ||
            elementId.includes('login')
        )) {
            return true;
        }

        if (description.includes('input') || description.includes('field')) {
            if (element.tag.includes('EditText') || element.tag.includes('TextField')) {
                return true;
            }
        }

        // Keyword matching
        const keywords = description.split(' ');
        for (const keyword of keywords) {
            if (keyword.length > 2) { // Ignore short words
                if (elementText.includes(keyword) || 
                    elementDesc.includes(keyword) || 
                    elementId.includes(keyword)) {
                    return true;
                }
            }
        }

        return false;
    }

    calculateConfidence(element, targetDescription, textToFind) {
        let confidence = 0;

        // Exact text match
        if (textToFind && element.text && element.text.toLowerCase() === textToFind.toLowerCase()) {
            confidence += 0.8;
        } else if (textToFind && element.text && element.text.toLowerCase().includes(textToFind.toLowerCase())) {
            confidence += 0.6;
        }

        // Content description match
        if (textToFind && element.contentDesc && element.contentDesc.toLowerCase().includes(textToFind.toLowerCase())) {
            confidence += 0.5;
        }

        // Clickable and enabled elements are more likely to be targets
        if (element.clickable) confidence += 0.2;
        if (element.enabled) confidence += 0.1;

        // Resource ID relevance
        if (element.resourceId && targetDescription.toLowerCase().split(' ').some(word => 
            element.resourceId.toLowerCase().includes(word))) {
            confidence += 0.3;
        }

        return Math.min(confidence, 1.0);
    }

    async generateHeuristicSuggestions(targetDescription, windowSize, options = {}) {
        const suggestions = [];
        
        // Common UI patterns based on description
        if (targetDescription.toLowerCase().includes('login')) {
            // Login buttons are often at the bottom center
            suggestions.push({
                description: 'Bottom center (common login button position)',
                coordinates: {
                    x: windowSize.width * 0.5,
                    y: windowSize.height * 0.8,
                    relativeX: 0.5,
                    relativeY: 0.8
                },
                confidence: 0.4,
                method: 'heuristic_pattern'
            });
        }

        if (targetDescription.toLowerCase().includes('continue') || targetDescription.toLowerCase().includes('next')) {
            // Continue/Next buttons are often bottom right or center
            suggestions.push({
                description: 'Bottom right (common continue button position)',
                coordinates: {
                    x: windowSize.width * 0.8,
                    y: windowSize.height * 0.85,
                    relativeX: 0.8,
                    relativeY: 0.85
                },
                confidence: 0.3,
                method: 'heuristic_pattern'
            });
        }

        if (targetDescription.toLowerCase().includes('close') || targetDescription.toLowerCase().includes('dismiss')) {
            // Close buttons are often top right
            suggestions.push({
                description: 'Top right (common close button position)',
                coordinates: {
                    x: windowSize.width * 0.9,
                    y: windowSize.height * 0.1,
                    relativeX: 0.9,
                    relativeY: 0.1
                },
                confidence: 0.3,
                method: 'heuristic_pattern'
            });
        }

        // Add coordinate hints if provided
        if (options.coordinateHints) {
            const hints = options.coordinateHints;
            suggestions.push({
                description: 'User-provided coordinate hint',
                coordinates: {
                    x: windowSize.width * hints.x,
                    y: windowSize.height * hints.y,
                    relativeX: hints.x,
                    relativeY: hints.y
                },
                confidence: 0.7,
                method: 'coordinate_hint'
            });
        }

        return suggestions;
    }

    async handleSmartFindAndClick(args) {
        try {
            this.validateRequiredParams(args, ['strategy', 'selector']);
            await this.ensureConnection();

            const { 
                strategy, 
                selector, 
                fallbackOptions = {}, 
                timeout = 10000,
                enableScrolling = true,
                scrollDirection = 'down',
                maxScrollAttempts = 8
            } = args;

            return await this.performActionWithStateCapture('smart_find_and_click', async () => {
                console.log(`🎯 Smart Find & Click: ${selector} (${strategy})`);

                // Phase 1: Primary strategy attempt
                let elementFound = false;
                let elementFoundButClickFailed = false;
                try {
                    const element = await this.findElementByStrategy(strategy, selector, timeout);
                    elementFound = true;
                    console.log(`✅ Element found with primary strategy: ${selector}`);
                    
                    // Check if element is displayed before clicking
                    const isDisplayed = await element.isDisplayed();
                    if (!isDisplayed) {
                        throw new Error('Element found but not displayed');
                    }
                    
                    await element.click();
                    
                    return this.createSuccessResponse(`✅ Element clicked using primary strategy: ${strategy}`, {
                        method: 'primary_strategy',
                        strategy,
                        selector,
                        success: true,
                        scrollUsed: false
                    });
                } catch (primaryError) {
                    console.log(`🔄 Primary strategy failed: ${primaryError.message}`);
                    
                    // Distinguish between element not found vs click failure
                    if (elementFound) {
                        elementFoundButClickFailed = true;
                        console.log(`⚠️ Element was found but click failed - will retry click without scrolling first`);
                        
                        // Try clicking again with a brief wait
                        try {
                            await new Promise(resolve => setTimeout(resolve, 500));
                            const retryElement = await this.findElementByStrategy(strategy, selector, 2000);
                            await retryElement.click();
                            
                            return this.createSuccessResponse(`✅ Element clicked on retry: ${strategy}`, {
                                method: 'retry_click',
                                strategy,
                                selector,
                                success: true,
                                scrollUsed: false,
                                retryAttempt: true
                            });
                        } catch (retryError) {
                            console.log(`🔄 Retry click also failed: ${retryError.message}`);
                        }
                    }
                    
                    // Phase 2: Try scrolling to find element (only if element was not found or still failing)
                    if (enableScrolling && !elementFoundButClickFailed) {
                        console.log(`📜 Attempting to find element with scrolling...`);
                        
                        try {
                            const scrollResult = await this.handleScrollToElement({
                                strategy,
                                selector,
                                direction: scrollDirection,
                                maxScrolls: maxScrollAttempts,
                                scrollDistance: 400
                            });
                            
                            if (scrollResult && !scrollResult.isError) {
                                // Element found through scrolling, now try to click it
                                try {
                                    const element = await this.findElementByStrategy(strategy, selector, 2000);
                                    await element.click();
                                    
                                    return this.createSuccessResponse(
                                        `✅ Element clicked after scrolling (${scrollResult.content.scrollsPerformed} scrolls)`, 
                                        {
                                            method: 'scroll_and_click',
                                            strategy,
                                            selector,
                                            success: true,
                                            scrollUsed: true,
                                            scrollsPerformed: scrollResult.content.scrollsPerformed,
                                            scrollDirection
                                        }
                                    );
                                } catch (clickError) {
                                    console.log(`❌ Element found through scroll but click failed: ${clickError.message}`);
                                }
                            } else {
                                console.log(`❌ Scrolling failed to find element: ${scrollResult?.message || 'Unknown error'}`);
                            }
                        } catch (scrollError) {
                            console.log(`❌ Scroll attempt failed: ${scrollError.message}`);
                        }
                    }
                    
                    // Phase 3: Try alternative scroll direction (only if element was not found initially)
                    if (enableScrolling && scrollDirection === 'up' && !elementFoundButClickFailed) {
                        console.log(`🔄 Trying reverse scroll direction (down) with full scroll attempts...`);
                        try {
                            const reverseScrollResult = await this.handleScrollToElement({
                                strategy,
                                selector,
                                direction: 'up',
                                maxScrolls: maxScrollAttempts, // Use full scroll attempts, not limited
                                scrollDistance: 400
                            });
                            
                            if (reverseScrollResult && !reverseScrollResult.isError) {
                                try {
                                    const element = await this.findElementByStrategy(strategy, selector, 2000);
                                    await element.click();
                                    
                                    return this.createSuccessResponse(
                                        `✅ Element clicked after reverse scrolling (${reverseScrollResult.content.scrollsPerformed} scrolls down)`, 
                                        {
                                            method: 'reverse_scroll_and_click',
                                            strategy,
                                            selector,
                                            success: true,
                                            scrollUsed: true,
                                            scrollsPerformed: reverseScrollResult.content.scrollsPerformed,
                                            scrollDirection: 'up'
                                        }
                                    );
                                } catch (clickError) {
                                    console.log(`❌ Element found through reverse scroll but click failed: ${clickError.message}`);
                                }
                            }
                        } catch (reverseScrollError) {
                            console.log(`❌ Reverse scroll attempt failed: ${reverseScrollError.message}`);
                        }
                    }
                    
                    // Phase 4: Coordinate-based fallback (prioritized when element was found but click failed)
                    if (fallbackOptions.enableScreenshotAnalysis !== false) {
                        const priorityMessage = elementFoundButClickFailed ? 
                            'Element found but click failed - trying coordinate-based click...' : 
                            'Attempting coordinate-based fallback...';
                        console.log(`🎯 ${priorityMessage}`);
                        
                        try {
                            return await this.attemptCoordinateBasedClick(
                                selector, 
                                strategy, 
                                { ...fallbackOptions, elementWasFound: elementFoundButClickFailed }, 
                                primaryError
                            );
                        } catch (fallbackError) {
                            console.log(`❌ Coordinate fallback failed: ${fallbackError.message}`);
                        }
                    }
                    
                    // Phase 5: Final failure with detailed context
                    const failureContext = elementFoundButClickFailed ? 
                        'Element was found but clicking consistently failed' : 
                        'Element could not be found through any method';
                    throw new Error(`❌ All methods failed to find and click element: ${selector}. Context: ${failureContext}. Primary error: ${primaryError.message}`);
                }
            }, args);
        } catch (error) {
            return this.createErrorResponse('smart_find_and_click', error);
        }
    }

    async attemptCoordinateBasedClick(originalSelector, originalStrategy, fallbackOptions, primaryError) {
        try {
            // Take a fresh screenshot for analysis
            const screenshotPath = path.join(this.autoStateCapture.outputDir, `fallback_analysis_${Date.now()}.png`);
            await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
            
            const screenshot = await this.driver.takeScreenshot();
            await fs.writeFile(screenshotPath, screenshot, 'base64');

            // Analyze screenshot to find target element
            const targetDescription = fallbackOptions.textToFind || originalSelector;
            const analysis = await this.analyzeScreenshotForElement(
                screenshotPath, 
                targetDescription, 
                fallbackOptions
            );

            if (!analysis || analysis.suggestions.length === 0) {
                throw new Error(`No fallback coordinates found for: ${originalSelector}`);
            }

            // Try the best suggestion
            const bestSuggestion = analysis.suggestions[0];
            
            if (bestSuggestion.confidence < this.coordinateFallback.confidenceThreshold) {
                console.warn(`Low confidence (${bestSuggestion.confidence}) for coordinate fallback`);
            }

            // Perform coordinate-based click
            await this.performCoordinateClick(bestSuggestion.coordinates.x, bestSuggestion.coordinates.y);

            return this.createSuccessResponse(
                `✅ Element clicked using coordinate fallback (confidence: ${bestSuggestion.confidence.toFixed(2)})`,
                {
                    method: 'coordinate_fallback',
                    originalError: primaryError.message,
                    fallbackCoordinates: bestSuggestion.coordinates,
                    confidence: bestSuggestion.confidence,
                    analysisMethod: bestSuggestion.method,
                    description: bestSuggestion.description,
                    allSuggestions: analysis.suggestions.map(s => ({
                        description: s.description,
                        confidence: s.confidence,
                        coordinates: s.coordinates
                    }))
                }
            );
        } catch (fallbackError) {
            throw new Error(`Primary strategy failed: ${primaryError.message}. Fallback also failed: ${fallbackError.message}`);
        }
    }

    async performCoordinateClick(x, y, duration = 100) {
        if (this.currentPlatform === 'iOS') {
            await this.driver.execute('mobile: tap', {
                x: Math.round(x),
                y: Math.round(y)
            });
        } else {
            await this.driver.touchAction({
                action: 'tap',
                x: Math.round(x),
                y: Math.round(y)
            });
        }
        
        // Wait for any UI response
        await this.driver.pause(duration);
    }

    async handleAnalyzeScreenshot(args) {
        try {
            this.validateRequiredParams(args, ['targetDescription']);
            await this.ensureConnection();

            const { targetDescription, textToFind, elementType = 'any', region } = args;

            // Take screenshot for analysis
            const screenshotPath = path.join(this.autoStateCapture.outputDir, `analysis_${Date.now()}.png`);
            await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
            
            const screenshot = await this.driver.takeScreenshot();
            await fs.writeFile(screenshotPath, screenshot, 'base64');

            // Perform analysis
            const analysis = await this.analyzeScreenshotForElement(
                screenshotPath,
                targetDescription,
                { textToFind, elementType, region }
            );

            if (!analysis) {
                return this.createErrorResponse('analyze_screenshot', 
                    new Error('Screenshot analysis failed'));
            }

            return this.createSuccessResponse(
                `Screenshot analyzed, found ${analysis.suggestions.length} suggestions`,
                {
                    targetDescription,
                    textToFind,
                    windowSize: analysis.windowSize,
                    suggestions: analysis.suggestions,
                    bestMatch: analysis.suggestions[0] || null,
                    confidence: analysis.confidence,
                    screenshotPath,
                    analysisMethod: analysis.method
                }
            );
        } catch (error) {
            return this.createErrorResponse('analyze_screenshot', error);
        }
    }

    async handleTapCoordinates(args) {
        try {
            this.validateRequiredParams(args, ['x', 'y']);
            await this.ensureConnection();

            const { 
                x, 
                y, 
                coordinateSystem = 'absolute', 
                referenceElement,
                duration = 100 
            } = args;

            return await this.performActionWithStateCapture('tap_coordinates', async () => {
                let finalX = x;
                let finalY = y;

                if (coordinateSystem === 'relative') {
                    // Convert relative coordinates (0.0-1.0) to absolute
                    const windowSize = await this.driver.getWindowSize();
                    finalX = windowSize.width * x;
                    finalY = windowSize.height * y;
                } else if (coordinateSystem === 'relative_to_element' && referenceElement) {
                    // Find reference element and calculate relative position
                    const refElement = await this.findElementByStrategy(
                        referenceElement.strategy, 
                        referenceElement.selector, 
                        5000
                    );
                    const refLocation = await refElement.getLocation();
                    const refSize = await refElement.getSize();
                    
                    finalX = refLocation.x + (refSize.width * x);
                    finalY = refLocation.y + (refSize.height * y);
                }

                await this.performCoordinateClick(finalX, finalY, duration);

                return this.createSuccessResponse(
                    `✅ Tapped at coordinates (${Math.round(finalX)}, ${Math.round(finalY)})`,
                    {
                        originalCoordinates: { x, y },
                        finalCoordinates: { x: Math.round(finalX), y: Math.round(finalY) },
                        coordinateSystem,
                        duration,
                        referenceElement: referenceElement || null
                    }
                );
            }, args);
        } catch (error) {
            return this.createErrorResponse('tap_coordinates', error);
        }
    }

    async handleCaptureStepScreenshot(args) {
        try {
            await this.ensureConnection();

            const { 
                stepNumber, 
                stepDescription, 
                expectedOutcome, 
                assertionPoints = [], 
                filename,
                includePageSource = true 
            } = args;

            console.log(`📸 Capturing step ${stepNumber} screenshot: ${stepDescription}`);

            const timestamp = Date.now();
            const stepId = `step_${stepNumber}_${timestamp}`;
            
            // Generate filename if not provided
            const screenshotFilename = filename || `step_${stepNumber}_${stepDescription.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.png`;
            
            // Ensure capture directory exists
            await fs.mkdir(this.autoStateCapture.outputDir, { recursive: true });

            // Capture screenshot
            let screenshotPath = null;
            let screenshotBase64 = null;
            try {
                screenshotBase64 = await this.driver.takeScreenshot();
                screenshotPath = path.join(this.autoStateCapture.outputDir, screenshotFilename);
                await fs.writeFile(screenshotPath, screenshotBase64, 'base64');
                console.log(`✅ Step screenshot saved: ${screenshotPath}`);
            } catch (error) {
                console.warn('Failed to capture step screenshot:', error.message);
                throw new Error(`Screenshot capture failed: ${error.message}`);
            }

            // Capture page source if requested
            let pageSourcePath = null;
            let pageSourceContent = null;
            let elementCount = 0;
            if (includePageSource) {
                try {
                    pageSourceContent = await this.driver.getPageSource();
                    const pageSourceFilename = `step_${stepNumber}_page_source_${timestamp}.xml`;
                    pageSourcePath = path.join(this.autoStateCapture.outputDir, pageSourceFilename);
                    await fs.writeFile(pageSourcePath, pageSourceContent, 'utf8');
                    elementCount = (pageSourceContent.match(/<[^/][^>]*>/g) || []).length;
                    console.log(`✅ Step page source saved: ${pageSourcePath} (${elementCount} elements)`);
                } catch (error) {
                    console.warn('Failed to capture step page source:', error.message);
                }
            }

            // Get current window info for context
            let windowInfo = {};
            try {
                windowInfo = await this.driver.getWindowSize();
            } catch (error) {
                console.warn('Failed to get window info:', error.message);
            }

            // Get current app context
            let appContext = {};
            try {
                if (this.currentPlatform === 'Android') {
                    appContext.currentActivity = await this.driver.getCurrentActivity();
                    appContext.currentPackage = await this.driver.getCurrentPackage();
                } else if (this.currentPlatform === 'iOS') {
                    appContext.bundleId = await this.driver.getCapabilities().bundleId;
                }
            } catch (error) {
                console.warn('Failed to get app context:', error.message);
            }

            // Generate dynamic assertion recommendations based on page content
            const dynamicAssertions = this.generateStepAssertionRecommendations(
                stepNumber, 
                stepDescription, 
                pageSourceContent,
                assertionPoints
            );

            // Analyze current UI state for assertion guidance
            const uiAnalysis = this.analyzeUIStateForAssertions(pageSourceContent, expectedOutcome);

            const stepCapture = {
                stepNumber,
                stepDescription,
                expectedOutcome,
                assertionPoints,
                id: stepId,
                timestamp,
                captureTime: new Date(timestamp).toISOString(),
                platform: this.currentPlatform,
                screenshotPath,
                screenshotFilename,
                pageSourcePath,
                pageSourceContent: includePageSource ? pageSourceContent : null,
                elementCount,
                windowInfo,
                appContext,
                assertionGuidance: {
                    userDefinedAssertions: assertionPoints,
                    recommendedAssertions: dynamicAssertions,
                    uiStateAnalysis: uiAnalysis,
                    nextStepGuidance: this.generateNextStepGuidance(stepNumber, stepDescription, pageSourceContent)
                }
            };

            // Add to recent captures
            this.autoStateCapture.lastCaptures.push({
                id: stepId,
                timestamp,
                actionName: `step_${stepNumber}`,
                platform: this.currentPlatform,
                screenshotPath,
                pageSourcePath,
                captureTime: stepCapture.captureTime
            });

            // Maintain retention limit
            if (this.autoStateCapture.lastCaptures.length > this.autoStateCapture.retainCount) {
                this.autoStateCapture.lastCaptures.shift();
            }

            return this.createSuccessResponse(
                `📸 Step ${stepNumber} screenshot captured: ${stepDescription}`,
                {
                    stepCapture,
                    screenshotAvailable: !!screenshotPath,
                    pageSourceAvailable: !!pageSourcePath,
                    assertionReady: true,
                    files: {
                        screenshot: screenshotPath,
                        pageSource: pageSourcePath
                    }
                }
            );

        } catch (error) {
            return this.createErrorResponse('capture_step_screenshot', error);
        }
    }

    // Generate step-specific assertion recommendations
    generateStepAssertionRecommendations(stepNumber, stepDescription, pageSource, userAssertions) {
        const recommendations = [];

        // Add user-defined assertions first
        if (userAssertions && userAssertions.length > 0) {
            recommendations.push(...userAssertions.map(assertion => `USER DEFINED: ${assertion}`));
        }

        // Generate recommendations based on step description keywords
        const desc = stepDescription.toLowerCase();
        
        if (desc.includes('login') || desc.includes('sign in')) {
            recommendations.push(
                'Verify login form elements are visible and accessible',
                'Check if username/email and password fields are present',
                'Confirm login button is clickable',
                'Look for any authentication error messages'
            );
        }

        if (desc.includes('navigate') || desc.includes('open') || desc.includes('go to')) {
            recommendations.push(
                'Verify correct page/screen has loaded',
                'Check page title or header content',
                'Confirm expected navigation elements are visible',
                'Look for loading indicators or errors'
            );
        }

        if (desc.includes('enter') || desc.includes('type') || desc.includes('input')) {
            recommendations.push(
                'Verify text input was successful',
                'Check field validation states',
                'Confirm cursor position or field focus',
                'Look for input suggestions or dropdowns'
            );
        }

        if (desc.includes('click') || desc.includes('tap') || desc.includes('press')) {
            recommendations.push(
                'Verify button/element was successfully activated',
                'Check for expected UI response or feedback',
                'Confirm any state changes occurred',
                'Look for loading or transition animations'
            );
        }

        if (desc.includes('scroll') || desc.includes('swipe')) {
            recommendations.push(
                'Verify content scrolled and new elements are visible',
                'Check scroll position indicators',
                'Confirm target content is now accessible',
                'Look for end-of-content indicators'
            );
        }

        if (desc.includes('submit') || desc.includes('send') || desc.includes('confirm')) {
            recommendations.push(
                'Verify form submission was successful',
                'Check for confirmation messages or feedback',
                'Look for error messages or validation issues',
                'Confirm expected post-submission state'
            );
        }

        // Add dynamic recommendations based on page content analysis
        if (pageSource) {
            if (pageSource.includes('error') || pageSource.includes('Error')) {
                recommendations.unshift('🚨 ERROR DETECTED: Investigate error messages or dialogs');
            }
            if (pageSource.includes('loading') || pageSource.includes('Loading')) {
                recommendations.push('⏳ LOADING STATE: Wait for completion before proceeding');
            }
            if (pageSource.includes('success') || pageSource.includes('Success')) {
                recommendations.push('✅ SUCCESS INDICATOR: Confirm success message details');
            }
        }

        // Add step-specific context
        recommendations.push(`STEP ${stepNumber} CONTEXT: Validate this step aligns with overall workflow goals`);

        return recommendations;
    }

    // Analyze UI state for assertion guidance
    analyzeUIStateForAssertions(pageSource, expectedOutcome) {
        const analysis = {
            elementsDetected: 0,
            interactiveElements: 0,
            errorIndicators: [],
            successIndicators: [],
            loadingStates: [],
            formElements: [],
            navigationElements: [],
            contentSummary: ''
        };

        if (!pageSource) {
            analysis.contentSummary = 'Page source not available for analysis';
            return analysis;
        }

        // Count elements
        analysis.elementsDetected = (pageSource.match(/<[^/][^>]*>/g) || []).length;

        // Find interactive elements
        const interactivePatterns = ['button', 'clickable="true"', 'input', 'textfield', 'switch'];
        analysis.interactiveElements = interactivePatterns.reduce((count, pattern) => {
            return count + (pageSource.toLowerCase().match(new RegExp(pattern, 'gi')) || []).length;
        }, 0);

        // Detect error indicators
        const errorPatterns = ['error', 'failed', 'invalid', 'denied', 'unauthorized'];
        analysis.errorIndicators = errorPatterns.filter(pattern => 
            pageSource.toLowerCase().includes(pattern)
        );

        // Detect success indicators
        const successPatterns = ['success', 'completed', 'confirmed', 'welcome', 'dashboard'];
        analysis.successIndicators = successPatterns.filter(pattern => 
            pageSource.toLowerCase().includes(pattern)
        );

        // Detect loading states
        const loadingPatterns = ['loading', 'spinner', 'progress', 'wait'];
        analysis.loadingStates = loadingPatterns.filter(pattern => 
            pageSource.toLowerCase().includes(pattern)
        );

        // Find form elements
        const formPatterns = ['edittext', 'textfield', 'input', 'form', 'submit'];
        analysis.formElements = formPatterns.filter(pattern => 
            pageSource.toLowerCase().includes(pattern)
        );

        // Find navigation elements
        const navPatterns = ['navigation', 'menu', 'toolbar', 'header', 'footer'];
        analysis.navigationElements = navPatterns.filter(pattern => 
            pageSource.toLowerCase().includes(pattern)
        );

        // Generate content summary
        if (expectedOutcome) {
            analysis.contentSummary = `Expected: ${expectedOutcome}. `;
        }
        analysis.contentSummary += `Found ${analysis.elementsDetected} UI elements, ${analysis.interactiveElements} interactive. `;
        
        if (analysis.errorIndicators.length > 0) {
            analysis.contentSummary += `⚠️ Errors: ${analysis.errorIndicators.join(', ')}. `;
        }
        if (analysis.successIndicators.length > 0) {
            analysis.contentSummary += `✅ Success: ${analysis.successIndicators.join(', ')}. `;
        }
        if (analysis.loadingStates.length > 0) {
            analysis.contentSummary += `⏳ Loading: ${analysis.loadingStates.join(', ')}. `;
        }

        return analysis;
    }

    // Generate guidance for next steps
    generateNextStepGuidance(stepNumber, stepDescription, pageSource) {
        const guidance = [];
        
        guidance.push(`✅ Step ${stepNumber} completed: ${stepDescription}`);
        guidance.push(`📸 Screenshot and page source captured for validation`);
        
        // Analyze current state to suggest next actions
        if (pageSource) {
            if (pageSource.toLowerCase().includes('error')) {
                guidance.push(`🚨 Error detected - Review error state before proceeding`);
                guidance.push(`🔧 Consider error handling or user notification steps`);
            } else if (pageSource.toLowerCase().includes('loading')) {
                guidance.push(`⏳ Loading state detected - Wait for completion`);
                guidance.push(`🕐 Consider adding wait conditions for next step`);
            } else if (pageSource.toLowerCase().includes('success')) {
                guidance.push(`✅ Success state detected - Ready for next step`);
                guidance.push(`➡️ Proceed with next action in workflow`);
            }
        }
        
        guidance.push(`🔍 Use verify_action_result to validate step completion`);
        guidance.push(`📋 Review screenshot against expected outcome`);
        guidance.push(`➡️ Proceed to step ${stepNumber + 1} when assertions pass`);
        
        return guidance;
    }
}

// Export the class for testing
export { AppiumMCPServer };

// Start the server
const server = new AppiumMCPServer();
server.run().catch(console.error);
