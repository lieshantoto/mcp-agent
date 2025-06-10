#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { remote } from 'webdriverio';

class WebDriverIOAppiumMCPServer {
  constructor() {
    this.sessions = new Map();
    this.server = new Server(
      {
        name: 'webdriverio-appium-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'create_session',
            description: 'Create a new Appium session for mobile app automation',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: {
                  type: 'string',
                  description: 'Unique identifier for this session',
                },
                platform: {
                  type: 'string',
                  enum: ['iOS', 'Android'],
                  description: 'Mobile platform (iOS or Android)',
                },
                deviceName: {
                  type: 'string',
                  description: 'Name of the device',
                },
                appPath: {
                  type: 'string',
                  description: 'Path to app file, bundle ID, or package name',
                },
                appiumServer: {
                  type: 'string',
                  description: 'Appium server URL',
                  default: 'http://127.0.0.1:4723',
                },
                udid: {
                  type: 'string',
                  description: 'Device UDID (iOS only)',
                },
                additionalCapabilities: {
                  type: 'object',
                  description: 'Additional capabilities for the session. For iOS real devices, you can include: derivedDataPath, updatedWDABundleId, xcodeOrgId, xcodeSigningId',
                  properties: {
                    derivedDataPath: {
                      type: 'string',
                      description: 'Path to Xcode derived data for real iOS devices'
                    },
                    updatedWDABundleId: {
                      type: 'string', 
                      description: 'Updated WebDriverAgent bundle ID for real iOS devices'
                    },
                    xcodeOrgId: {
                      type: 'string',
                      description: 'Xcode organization ID for real iOS devices'
                    },
                    xcodeSigningId: {
                      type: 'string',
                      description: 'Xcode signing ID for real iOS devices (default: iPhone Developer)'
                    }
                  }
                },
              },
              required: ['sessionId', 'platform', 'deviceName'],
            },
          },
          {
            name: 'find_element',
            description: 'Find an element on the current screen',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: {
                  type: 'string',
                  description: 'Session identifier',
                },
                selector: {
                  type: 'string',
                  description: 'Element selector',
                },
                selectorType: {
                  type: 'string',
                  enum: ['css', 'xpath', 'id', 'accessibilityId', 'className', 'name'],
                  default: 'css',
                },
              },
              required: ['sessionId', 'selector'],
            },
          },
          {
            name: 'click_element',
            description: 'Click on an element',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: {
                  type: 'string',
                  description: 'Session identifier',
                },
                selector: {
                  type: 'string',
                  description: 'Element selector',
                },
                selectorType: {
                  type: 'string',
                  enum: ['css', 'xpath', 'id', 'accessibilityId', 'className', 'name'],
                  default: 'css',
                },
              },
              required: ['sessionId', 'selector'],
            },
          },
          {
            name: 'send_keys',
            description: 'Send text input to an element',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: {
                  type: 'string',
                  description: 'Session identifier',
                },
                selector: {
                  type: 'string',
                  description: 'Element selector',
                },
                text: {
                  type: 'string',
                  description: 'Text to input',
                },
                selectorType: {
                  type: 'string',
                  enum: ['css', 'xpath', 'id', 'accessibilityId', 'className', 'name'],
                  default: 'css',
                },
              },
              required: ['sessionId', 'selector', 'text'],
            },
          },
          {
            name: 'get_text',
            description: 'Get text content from an element',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: {
                  type: 'string',
                  description: 'Session identifier',
                },
                selector: {
                  type: 'string',
                  description: 'Element selector',
                },
                selectorType: {
                  type: 'string',
                  enum: ['css', 'xpath', 'id', 'accessibilityId', 'className', 'name'],
                  default: 'css',
                },
              },
              required: ['sessionId', 'selector'],
            },
          },
          {
            name: 'scroll',
            description: 'Scroll in a direction',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: {
                  type: 'string',
                  description: 'Session identifier',
                },
                direction: {
                  type: 'string',
                  enum: ['up', 'down', 'left', 'right'],
                  description: 'Direction to scroll',
                },
                distance: {
                  type: 'number',
                  description: 'Distance to scroll (optional)',
                },
              },
              required: ['sessionId', 'direction'],
            },
          },
          {
            name: 'swipe',
            description: 'Perform a swipe gesture',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: {
                  type: 'string',
                  description: 'Session identifier',
                },
                startX: {
                  type: 'number',
                  description: 'Start X coordinate',
                },
                startY: {
                  type: 'number',
                  description: 'Start Y coordinate',
                },
                endX: {
                  type: 'number',
                  description: 'End X coordinate',
                },
                endY: {
                  type: 'number',
                  description: 'End Y coordinate',
                },
                duration: {
                  type: 'number',
                  description: 'Duration in milliseconds',
                  default: 1000,
                },
              },
              required: ['sessionId', 'startX', 'startY', 'endX', 'endY'],
            },
          },
          {
            name: 'take_screenshot',
            description: 'Take a screenshot of the current screen',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: {
                  type: 'string',
                  description: 'Session identifier',
                },
              },
              required: ['sessionId'],
            },
          },
          {
            name: 'get_page_source',
            description: 'Get the XML page source of the current screen',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: {
                  type: 'string',
                  description: 'Session identifier',
                },
              },
              required: ['sessionId'],
            },
          },
          {
            name: 'wait_for_element',
            description: 'Wait for an element to appear',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: {
                  type: 'string',
                  description: 'Session identifier',
                },
                selector: {
                  type: 'string',
                  description: 'Element selector',
                },
                selectorType: {
                  type: 'string',
                  enum: ['css', 'xpath', 'id', 'accessibilityId', 'className', 'name'],
                  default: 'css',
                },
                timeout: {
                  type: 'number',
                  description: 'Timeout in milliseconds',
                  default: 10000,
                },
              },
              required: ['sessionId', 'selector'],
            },
          },
          {
            name: 'close_session',
            description: 'Close an Appium session',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: {
                  type: 'string',
                  description: 'Session identifier',
                },
              },
              required: ['sessionId'],
            },
          },
          {
            name: 'list_sessions',
            description: 'List all active sessions',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'restart_wda',
            description: 'Restart WebDriverAgent on iOS device',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: {
                  type: 'string',
                  description: 'Session identifier to restart WebDriverAgent for',
                },
              },
              required: ['sessionId'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'create_session':
            return await this.createSession(args);
          case 'find_element':
            return await this.findElement(args);
          case 'click_element':
            return await this.clickElement(args);
          case 'send_keys':
            return await this.sendKeys(args);
          case 'get_text':
            return await this.getText(args);
          case 'scroll':
            return await this.scroll(args);
          case 'swipe':
            return await this.swipe(args);
          case 'take_screenshot':
            return await this.takeScreenshot(args);
          case 'get_page_source':
            return await this.getPageSource(args);
          case 'wait_for_element':
            return await this.waitForElement(args);
          case 'close_session':
            return await this.closeSession(args);
          case 'list_sessions':
            return await this.listSessions();
          case 'restart_wda':
            return await this.restartWDA(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  async createSession(args) {
    const {
      sessionId,
      platform,
      deviceName,
      appPath,
      appiumServer = 'http://127.0.0.1:4723',
      udid,
      additionalCapabilities = {},
    } = args;

    console.log(`Creating session with ID: ${sessionId}`);
    console.log(`Current sessions count: ${this.sessions.size}`);
    console.log(`Existing session IDs: ${Array.from(this.sessions.keys()).join(', ')}`);

    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`);
    }

    // Build W3C compliant capabilities for Appium 2.x
    // WebDriverIO expects capabilities to be wrapped in firstMatch for W3C compliance
    const baseCapabilities = {
      platformName: platform,
      'appium:deviceName': deviceName,
      'appium:newCommandTimeout': 600,
      'appium:noReset': true,
      'appium:fullReset': false,
    };

    // Platform-specific configuration
    if (platform === 'iOS') {
      baseCapabilities['appium:automationName'] = 'XCUITest';
      
      // Check if we have a UDID (real device) or not (simulator)
      if (udid) {
        // Real device configuration
        baseCapabilities['appium:udid'] = udid;
        baseCapabilities['appium:platformVersion'] = '18.0';
        baseCapabilities['appium:realDevice'] = true;
        baseCapabilities['appium:xcodeOrgId'] = additionalCapabilities.xcodeOrgId || process.env.XCODE_ORG_ID || '';
        baseCapabilities['appium:xcodeSigningId'] = additionalCapabilities.xcodeSigningId || process.env.XCODE_SIGNING_ID || 'iPhone Developer';
        
        // WebDriverAgent configuration for better stability
        baseCapabilities['appium:useNewWDA'] = false; // Reuse existing WDA
        baseCapabilities['appium:wdaConnectionTimeout'] = 120000;
        baseCapabilities['appium:wdaStartupRetries'] = 3;
        baseCapabilities['appium:wdaStartupRetryInterval'] = 10000;
        baseCapabilities['appium:skipLogCapture'] = true;
        baseCapabilities['appium:shouldUseSingletonTestManager'] = false;
        
        // Use derived data path if provided via environment or additional capabilities
        if (additionalCapabilities.derivedDataPath || process.env.DERIVED_DATA_PATH) {
          baseCapabilities['appium:derivedDataPath'] = additionalCapabilities.derivedDataPath || process.env.DERIVED_DATA_PATH;
        }
        
        // For real devices, we often need to use updatedWDABundleId
        if (additionalCapabilities.updatedWDABundleId) {
          baseCapabilities['appium:updatedWDABundleId'] = additionalCapabilities.updatedWDABundleId;
        }
        
        // Add WDA launch timeout
        baseCapabilities['appium:wdaLaunchTimeout'] = 120000;
      } else {
        // Simulator configuration
        baseCapabilities['appium:platformVersion'] = '18.0';
        baseCapabilities['appium:realDevice'] = false;
      }
      
      // Handle app vs bundleId
      if (appPath) {
        if (appPath.endsWith('.ipa') || appPath.startsWith('/')) {
          baseCapabilities['appium:app'] = appPath;
        } else {
          baseCapabilities['appium:bundleId'] = appPath;
        }
      }
    } else if (platform === 'Android') {
      baseCapabilities['appium:automationName'] = 'UiAutomator2';
      baseCapabilities['appium:platformVersion'] = '11';
      baseCapabilities['appium:autoGrantPermissions'] = true;
      
      // Handle app vs appPackage
      if (appPath) {
        if (appPath.endsWith('.apk') || appPath.startsWith('/')) {
          baseCapabilities['appium:app'] = appPath;
        } else {
          baseCapabilities['appium:appPackage'] = appPath;
        }
      }
    }

    // Merge additional capabilities with proper prefixing
    Object.keys(additionalCapabilities).forEach(key => {
      // If key doesn't have vendor prefix, add appium: prefix
      const capKey = key.includes(':') ? key : `appium:${key}`;
      baseCapabilities[capKey] = additionalCapabilities[key];
    });

    // WebDriverIO options with proper W3C capabilities structure
    const options = {
      protocol: 'http',
      hostname: new URL(appiumServer).hostname,
      port: parseInt(new URL(appiumServer).port) || 4723,
      path: '/',
      capabilities: {
        alwaysMatch: baseCapabilities,
        firstMatch: [{}]
      },
      logLevel: 'info',
      connectionRetryTimeout: 120000,
      connectionRetryCount: 3,
    };

    try {
      console.log('Creating WebDriverIO session with capabilities:', JSON.stringify(options.capabilities, null, 2));
      const driver = await remote(options);
      
      // Verify the driver was created successfully
      if (!driver) {
        throw new Error('WebDriverIO remote() returned null/undefined driver');
      }
      
      console.log(`Driver created successfully for session ${sessionId}`);
      
      this.sessions.set(sessionId, {
        driver,
        sessionId,
        platform,
        deviceName,
        appPath,
        udid,
        createdAt: new Date(),
      });

      console.log(`Session ${sessionId} stored successfully. Total sessions: ${this.sessions.size}`);
      console.log(`Session storage verification: ${this.sessions.has(sessionId) ? 'SUCCESS' : 'FAILED'}`);

      return {
        content: [
          {
            type: 'text',
            text: `Session ${sessionId} created successfully for ${platform} device: ${deviceName}`,
          },
        ],
      };
    } catch (error) {
      console.error('Session creation failed:', error.message);
      console.error('Full error:', error);
      throw new Error(`Failed to create session: ${error.message}. Verify Appium server is running at ${appiumServer} and device is connected.`);
    }
  }

  getSession(sessionId) {
    console.log(`Looking up session: ${sessionId}`);
    console.log(`Available sessions: ${Array.from(this.sessions.keys()).join(', ')}`);
    console.log(`Total sessions count: ${this.sessions.size}`);
    
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`Session ${sessionId} not found in sessions map`);
      throw new Error(`Session ${sessionId} not found`);
    }
    
    console.log(`Session ${sessionId} found successfully`);
    return session;
  }

  async validateSession(sessionId) {
    const session = this.getSession(sessionId);
    try {
      // Try to get the session status to check if it's still alive
      await session.driver.getUrl();
      return true;
    } catch (error) {
      console.error(`Session ${sessionId} appears to be dead: ${error.message}`);
      // Remove the dead session
      this.sessions.delete(sessionId);
      return false;
    }
  }

  async findElement(args) {
    const { sessionId, selector, selectorType = 'css' } = args;
    
    try {
      const isValid = await this.validateSession(sessionId);
      if (!isValid) {
        throw new Error(`Session ${sessionId} is no longer valid. Please create a new session.`);
      }
      
      const session = this.getSession(sessionId);

      const selectorMap = {
        css: selector,
        xpath: selector,
        id: selector,
        accessibilityId: `~${selector}`,
        className: selector,
        name: selector,
      };

      const element = await session.driver.$(selectorMap[selectorType]);
      const exists = await element.isExisting();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              found: exists,
              selector: selector,
              selectorType: selectorType,
            }),
          },
        ],
      };
    } catch (error) {
      if (error.message.includes('socket hang up') || error.message.includes('ECONNRESET')) {
        this.sessions.delete(sessionId);
        throw new Error(`WebDriverAgent connection lost for session ${sessionId}. Please create a new session. Original error: ${error.message}`);
      }
      throw error;
    }
  }

  async clickElement(args) {
    const { sessionId, selector, selectorType = 'css' } = args;
    const session = this.getSession(sessionId);

    const selectorMap = {
      css: selector,
      xpath: selector,
      id: selector,
      accessibilityId: `~${selector}`,
      className: selector,
      name: selector,
    };

    const element = await session.driver.$(selectorMap[selectorType]);
    await element.waitForExist({ timeout: 10000 });
    await element.click();

    return {
      content: [
        {
          type: 'text',
          text: `Clicked element: ${selector}`,
        },
      ],
    };
  }

  async sendKeys(args) {
    const { sessionId, selector, text, selectorType = 'css' } = args;
    const session = this.getSession(sessionId);

    const selectorMap = {
      css: selector,
      xpath: selector,
      id: selector,
      accessibilityId: `~${selector}`,
      className: selector,
      name: selector,
    };

    const element = await session.driver.$(selectorMap[selectorType]);
    await element.waitForExist({ timeout: 10000 });
    await element.setValue(text);

    return {
      content: [
        {
          type: 'text',
          text: `Sent text "${text}" to element: ${selector}`,
        },
      ],
    };
  }

  async getText(args) {
    const { sessionId, selector, selectorType = 'css' } = args;
    const session = this.getSession(sessionId);

    const selectorMap = {
      css: selector,
      xpath: selector,
      id: selector,
      accessibilityId: `~${selector}`,
      className: selector,
      name: selector,
    };

    const element = await session.driver.$(selectorMap[selectorType]);
    await element.waitForExist({ timeout: 10000 });
    const text = await element.getText();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            selector: selector,
            text: text,
          }),
        },
      ],
    };
  }

  async scroll(args) {
    const { sessionId, direction, distance = 500 } = args;
    const session = this.getSession(sessionId);

    const windowSize = await session.driver.getWindowSize();
    const centerX = windowSize.width / 2;
    const centerY = windowSize.height / 2;

    let startX = centerX;
    let startY = centerY;
    let endX = centerX;
    let endY = centerY;

    switch (direction) {
      case 'up':
        startY = centerY + distance / 2;
        endY = centerY - distance / 2;
        break;
      case 'down':
        startY = centerY - distance / 2;
        endY = centerY + distance / 2;
        break;
      case 'left':
        startX = centerX + distance / 2;
        endX = centerX - distance / 2;
        break;
      case 'right':
        startX = centerX - distance / 2;
        endX = centerX + distance / 2;
        break;
    }

    await session.driver.touchAction([
      { action: 'press', x: startX, y: startY },
      { action: 'wait', ms: 500 },
      { action: 'moveTo', x: endX, y: endY },
      { action: 'release' },
    ]);

    return {
      content: [
        {
          type: 'text',
          text: `Scrolled ${direction} by ${distance} pixels`,
        },
      ],
    };
  }

  async swipe(args) {
    const { sessionId, startX, startY, endX, endY, duration = 1000 } = args;
    const session = this.getSession(sessionId);

    await session.driver.touchAction([
      { action: 'press', x: startX, y: startY },
      { action: 'wait', ms: duration },
      { action: 'moveTo', x: endX, y: endY },
      { action: 'release' },
    ]);

    return {
      content: [
        {
          type: 'text',
          text: `Swiped from (${startX}, ${startY}) to (${endX}, ${endY})`,
        },
      ],
    };
  }

  async takeScreenshot(args) {
    const { sessionId } = args;
    
    try {
      const isValid = await this.validateSession(sessionId);
      if (!isValid) {
        throw new Error(`Session ${sessionId} is no longer valid. Please create a new session.`);
      }
      
      const session = this.getSession(sessionId);
      const screenshot = await session.driver.takeScreenshot();

      return {
        content: [
          {
            type: 'text',
            text: `Screenshot taken for session ${sessionId}`,
          },
          {
            type: 'image',
            data: screenshot,
            mimeType: 'image/png',
          },
        ],
      };
    } catch (error) {
      if (error.message.includes('socket hang up') || error.message.includes('ECONNRESET')) {
        this.sessions.delete(sessionId);
        throw new Error(`WebDriverAgent connection lost for session ${sessionId}. Please create a new session. Original error: ${error.message}`);
      }
      throw error;
    }
  }

  async getPageSource(args) {
    const { sessionId } = args;
    const session = this.getSession(sessionId);

    const source = await session.driver.getPageSource();

    return {
      content: [
        {
          type: 'text',
          text: `Page source for session ${sessionId}:\n${source}`,
        },
      ],
    };
  }

  async waitForElement(args) {
    const { sessionId, selector, selectorType = 'css', timeout = 10000 } = args;
    const session = this.getSession(sessionId);

    const selectorMap = {
      css: selector,
      xpath: selector,
      id: selector,
      accessibilityId: `~${selector}`,
      className: selector,
      name: selector,
    };

    const element = await session.driver.$(selectorMap[selectorType]);
    await element.waitForExist({ timeout });

    return {
      content: [
        {
          type: 'text',
          text: `Element found: ${selector}`,
        },
      ],
    };
  }

  async closeSession(args) {
    const { sessionId } = args;
    const session = this.getSession(sessionId);

    await session.driver.deleteSession();
    this.sessions.delete(sessionId);

    return {
      content: [
        {
          type: 'text',
          text: `Session ${sessionId} closed successfully`,
        },
      ],
    };
  }

  async listSessions() {
    const sessions = Array.from(this.sessions.values()).map(session => ({
      sessionId: session.sessionId,
      platform: session.platform,
      deviceName: session.deviceName,
      appPath: session.appPath,
      createdAt: session.createdAt,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(sessions, null, 2),
        },
      ],
    };
  }

  async restartWDA(args) {
    const { sessionId } = args;
    
    try {
      const session = this.getSession(sessionId);
      
      if (session.platform !== 'iOS') {
        throw new Error('WebDriverAgent restart is only available for iOS sessions');
      }

      console.log(`Attempting to restart WebDriverAgent for session ${sessionId}`);
      
      // Try to terminate the existing session gracefully
      try {
        await session.driver.deleteSession();
      } catch (e) {
        console.log('Could not gracefully close existing session, continuing...');
      }
      
      // Remove from sessions map
      this.sessions.delete(sessionId);
      
      return {
        content: [
          {
            type: 'text',
            text: `WebDriverAgent session ${sessionId} terminated. Please create a new session to reconnect.`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to restart WebDriverAgent: ${error.message}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('WebDriverIO Appium MCP server running on stdio');
    console.error('Available tools: create_session, find_element, click_element, send_keys, get_text, scroll, swipe, take_screenshot, get_page_source, wait_for_element, close_session, list_sessions');
  }
}

const server = new WebDriverIOAppiumMCPServer();
server.run().catch(console.error);
