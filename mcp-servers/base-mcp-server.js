#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

/**
 * Base MCP Server class that provides common functionality for all MCP servers
 * This class should be extended by specific server implementations
 */
export class BaseMCPServer {
    constructor(serverInfo, tools = []) {
        this.serverInfo = {
            name: serverInfo.name || 'base-mcp-server',
            version: serverInfo.version || '1.0.0',
            description: serverInfo.description || 'Base MCP Server',
            ...serverInfo,
        };

        this.tools = tools;
        this.toolHandlers = new Map();

        this.server = new Server(
            {
                name: this.serverInfo.name,
                version: this.serverInfo.version,
            },
            {
                capabilities: {
                    tools: {},
                },
            },
        );

        this.setupBaseHandlers();
    }

    /**
     * Setup base request handlers for tools
     */
    setupBaseHandlers() {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: this.tools,
        }));

        // Handle tool calls
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            try {
                if (this.toolHandlers.has(name)) {
                    const handler = this.toolHandlers.get(name);
                    return await handler(args);
                }
                throw new Error(`Unknown tool: ${name}`);
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error executing ${name}: ${error.message}`,
                        },
                    ],
                    isError: true,
                };
            }
        });
    }

    /**
     * Register a tool with its handler
     * @param {string} toolName - Name of the tool
     * @param {Function} handler - Handler function for the tool
     */
    registerTool(toolName, handler) {
        this.toolHandlers.set(toolName, handler);
    }

    /**
     * Add a tool definition to the tools array
     * @param {Object} toolDefinition - Tool definition object
     */
    addTool(toolDefinition) {
        this.tools.push(toolDefinition);
    }

    /**
     * Create standardized success response
     * @param {string} message - Success message
     * @param {Object} data - Optional data to include
     */
    createSuccessResponse(message, data = null) {
        const response = {
            content: [
                {
                    type: 'text',
                    text: message,
                },
            ],
        };

        if (data) {
            response.content.push({
                type: 'text',
                text: `\nData: ${JSON.stringify(data, null, 2)}`,
            });
        }

        return response;
    }

    /**
     * Create standardized error response
     * @param {string} toolName - Name of the tool that failed
     * @param {Error} error - Error object
     */
    createErrorResponse(toolName, error) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Error executing ${toolName}: ${error.message}`,
                },
            ],
            isError: true,
        };
    }

    /**
     * Validate required parameters
     * @param {Object} args - Arguments passed to tool
     * @param {Array} requiredParams - Array of required parameter names
     * @throws {Error} If required parameters are missing
     */
    validateRequiredParams(args, requiredParams) {
        const missing = requiredParams.filter((param) => !(param in args) || args[param] === undefined || args[param] === null);
        if (missing.length > 0) {
            throw new Error(`Missing required parameters: ${missing.join(', ')}`);
        }
    }

    /**
     * Start the MCP server
     */
    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);

        console.error(`🚀 ${this.serverInfo.name} v${this.serverInfo.version} started`);
        console.error(`📦 ${this.tools.length} tools available`);
        console.error(`🎯 ${this.serverInfo.description}`);
    }

    /**
     * Run the MCP server (alias for start)
     */
    async run() {
        return this.start();
    }

    /**
     * Get server information
     */
    getServerInfo() {
        return {
            ...this.serverInfo,
            toolsCount: this.tools.length,
            toolNames: this.tools.map((tool) => tool.name),
        };
    }

    /**
     * Log error to stderr
     * @param {string} message - Error message
     * @param {Error} error - Optional error object
     */
    logError(message, error = null) {
        console.error(`❌ [${this.serverInfo.name}] ${message}`);
        if (error) {
            console.error(`   Details: ${error.message}`);
            if (error.stack) {
                console.error(`   Stack: ${error.stack}`);
            }
        }
    }

    /**
     * Log info to stderr
     * @param {string} message - Info message
     */
    logInfo(message) {
        console.error(`ℹ️  [${this.serverInfo.name}] ${message}`);
    }

    /**
     * Log success to stderr
     * @param {string} message - Success message
     */
    logSuccess(message) {
        console.error(`✅ [${this.serverInfo.name}] ${message}`);
    }
}

/**
 * Common tool schemas that can be reused across servers
 */
export const CommonSchemas = {
    filePath: {
        type: 'string',
        description: 'Absolute path to the file',
    },
    pattern: {
        type: 'string',
        description: 'Search pattern or glob pattern',
    },
    content: {
        type: 'string',
        description: 'Content to write or process',
    },
    timeout: {
        type: 'number',
        description: 'Timeout in milliseconds',
        default: 30000,
    },
    maxResults: {
        type: 'number',
        description: 'Maximum number of results to return',
        default: 100,
    },
};

/**
 * Common utilities for file operations
 */
export const FileUtils = {
    /**
     * Check if file exists
     * @param {string} filePath - Path to file
     * @returns {boolean} True if file exists
     */
    async exists(filePath) {
        try {
            const fs = await import('fs/promises');
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    },

    /**
     * Ensure directory exists
     * @param {string} dirPath - Directory path
     */
    async ensureDir(dirPath) {
        const fs = await import('fs/promises');
        await fs.mkdir(dirPath, { recursive: true });
    },

    /**
     * Get file stats
     * @param {string} filePath - Path to file
     * @returns {Object} File stats
     */
    async getStats(filePath) {
        const fs = await import('fs/promises');
        return await fs.stat(filePath);
    },
};

export default BaseMCPServer;
