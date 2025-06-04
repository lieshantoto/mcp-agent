#!/usr/bin/env node

/**
 * MCP Test Execution Server
 * Handles test execution, validation, and terminal operations
 *
 * Tools: run_test_case, get_test_results, run_in_terminal, get_terminal_output, test_failure
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { BaseMCPServer } from './base-mcp-server.js';

class TestExecutionServer extends BaseMCPServer {
    constructor() {
        super({
            name: 'mcp-test-execution-server',
            version: '1.0.0',
            description: 'Test execution, validation, and terminal operations',
        });

        // Terminal sessions storage
        this.terminalSessions = new Map();
        this.sessionCounter = 0;

        this.registerTools();
    }

    registerTools() {
        // Register tool schemas
        this.addTool({
            name: 'run_test_case',
            description: 'Run a specific test case or test file',
            inputSchema: {
                type: 'object',
                properties: {
                    testFile: {
                        type: 'string',
                        description: 'Path to the test file to run',
                    },
                    testPattern: {
                        type: 'string',
                        description: 'Specific test pattern or name to run',
                    },
                    timeout: {
                        type: 'number',
                        description: 'Test timeout in milliseconds',
                        default: 30000,
                    },
                },
                required: ['testFile'],
            },
        });

        this.addTool({
            name: 'get_test_results',
            description: 'Get test execution results and reports',
            inputSchema: {
                type: 'object',
                properties: {
                    testFile: {
                        type: 'string',
                        description: 'Path to specific test file (optional)',
                    },
                    format: {
                        type: 'string',
                        enum: ['json', 'xml', 'html'],
                        description: 'Format of test results',
                        default: 'json',
                    },
                },
            },
        });

        this.addTool({
            name: 'run_in_terminal',
            description: 'Execute shell commands in a persistent terminal session',
            inputSchema: {
                type: 'object',
                properties: {
                    command: {
                        type: 'string',
                        description: 'The command to run in the terminal',
                    },
                    explanation: {
                        type: 'string',
                        description: 'A one-sentence description of what the command does',
                    },
                    isBackground: {
                        type: 'boolean',
                        description: 'Whether the command starts a background process',
                        default: false,
                    },
                },
                required: ['command', 'explanation'],
            },
        });

        this.addTool({
            name: 'get_terminal_output',
            description: 'Get the output of a terminal command previously started',
            inputSchema: {
                type: 'object',
                properties: {
                    id: {
                        type: 'string',
                        description: 'The ID of the terminal command output to check',
                    },
                },
                required: ['id'],
            },
        });

        this.addTool({
            name: 'test_failure',
            description: 'Report and analyze test failures',
            inputSchema: {
                type: 'object',
                properties: {
                    testFile: {
                        type: 'string',
                        description: 'Path to the failed test file',
                    },
                    errorMessage: {
                        type: 'string',
                        description: 'Error message from the test failure',
                    },
                    stackTrace: {
                        type: 'string',
                        description: 'Stack trace from the failure',
                    },
                },
                required: ['testFile', 'errorMessage'],
            },
        });

        // Register tool handlers
        this.registerTool('run_test_case', this.runTestCase.bind(this));
        this.registerTool('get_test_results', this.getTestResults.bind(this));
        this.registerTool('run_in_terminal', this.runInTerminal.bind(this));
        this.registerTool('get_terminal_output', this.getTerminalOutput.bind(this));
        this.registerTool('test_failure', this.testFailure.bind(this));
    }

    async runTestCase(args) {
        try {
            this.validateRequiredParams(args, ['testFile']);

            const { testFile, testPattern, timeout = 30000 } = args;

            // Determine test command based on file extension and project type
            let command;
            let commandArgs = [];

            if (testFile.endsWith('.js') || testFile.endsWith('.ts')) {
                // Check if it's a Jest/Node.js test
                if (await this.hasPackageJson() && await this.hasJest()) {
                    command = 'npx';
                    commandArgs = ['jest', testFile];
                    if (testPattern) commandArgs.push('--testNamePattern', testPattern);
                } else {
                    command = 'node';
                    commandArgs = [testFile];
                }
            } else if (testFile.endsWith('.py')) {
                command = 'python';
                commandArgs = ['-m', 'pytest', testFile];
                if (testPattern) commandArgs.push('-k', testPattern);
            } else {
                throw new Error(`Unsupported test file type: ${testFile}`);
            }

            const result = await this.executeCommand(command, commandArgs, { timeout });

            return this.createSuccessResponse(
                `Test execution completed for ${testFile}`,
                {
                    testFile,
                    command: `${command} ${commandArgs.join(' ')}`,
                    exitCode: result.exitCode,
                    stdout: result.stdout,
                    stderr: result.stderr,
                    duration: result.duration,
                },
            );
        } catch (error) {
            return this.createErrorResponse('run_test_case', error);
        }
    }

    async getTestResults(args) {
        try {
            const { testFile, format = 'json' } = args;

            // Look for test result files
            const possibleResultFiles = [
                'test-results.xml',
                'junit.xml',
                'test-results.json',
                'coverage/lcov-report/index.html',
            ];

            const results = {
                testFile,
                resultFiles: [],
                summary: null,
            };

            for (const resultFile of possibleResultFiles) {
                try {
                    const stats = await fs.stat(resultFile);
                    const content = await fs.readFile(resultFile, 'utf8');

                    results.resultFiles.push({
                        file: resultFile,
                        size: stats.size,
                        modified: stats.mtime,
                        content: format === 'json' ? this.parseResultContent(content, resultFile) : content,
                    });
                } catch (err) {
                    // File doesn't exist, continue
                }
            }

            // Try to extract summary from stdout/stderr if available
            if (testFile) {
                try {
                    results.summary = await this.extractTestSummary(testFile);
                } catch (err) {
                    console.warn('Could not extract test summary:', err.message);
                }
            }

            return this.createSuccessResponse(
                'Test results retrieved successfully',
                results,
            );
        } catch (error) {
            return this.createErrorResponse('get_test_results', error);
        }
    }

    async runInTerminal(args) {
        try {
            this.validateRequiredParams(args, ['command']);

            const {
                command,
                explanation = 'Running terminal command',
                isBackground = false,
                workingDirectory = process.cwd(),
                timeout = 30000,
            } = args;

            console.log(`Executing: ${explanation}`);

            if (isBackground) {
                // Start background process
                const sessionId = `bg_${++this.sessionCounter}`;
                const process = this.startBackgroundProcess(command, workingDirectory, sessionId);

                this.terminalSessions.set(sessionId, {
                    process,
                    command,
                    startTime: Date.now(),
                    isBackground: true,
                    workingDirectory,
                });

                return this.createSuccessResponse(
                    `Background process started: ${explanation}`,
                    {
                        sessionId,
                        command,
                        isBackground: true,
                        pid: process.pid,
                    },
                );
            }
            // Execute synchronously
            const result = await this.executeCommand('sh', ['-c', command], {
                timeout,
                cwd: workingDirectory,
            });

            return this.createSuccessResponse(
                `Command completed: ${explanation}`,
                {
                    command,
                    exitCode: result.exitCode,
                    stdout: result.stdout,
                    stderr: result.stderr,
                    duration: result.duration,
                },
            );
        } catch (error) {
            return this.createErrorResponse('run_in_terminal', error);
        }
    }

    async getTerminalOutput(args) {
        try {
            this.validateRequiredParams(args, ['id']);

            const { id } = args;
            const session = this.terminalSessions.get(id);

            if (!session) {
                throw new Error(`Terminal session ${id} not found`);
            }

            if (session.isBackground) {
                // Get current output from background process
                const output = await this.getBackgroundProcessOutput(session);

                return this.createSuccessResponse(
                    `Retrieved output for session ${id}`,
                    {
                        sessionId: id,
                        command: session.command,
                        isRunning: !session.process.killed,
                        startTime: session.startTime,
                        output,
                        pid: session.process.pid,
                    },
                );
            }
            throw new Error(`Session ${id} is not a background process`);
        } catch (error) {
            return this.createErrorResponse('get_terminal_output', error);
        }
    }

    async testFailure(args) {
        try {
            // Analyze test failures and provide debugging information
            const { testOutput, testFile } = args;

            const analysis = {
                failureType: null,
                errorMessage: null,
                stackTrace: null,
                suggestions: [],
                affectedFiles: [],
            };

            if (testOutput) {
                analysis.failureType = this.detectFailureType(testOutput);
                analysis.errorMessage = this.extractErrorMessage(testOutput);
                analysis.stackTrace = this.extractStackTrace(testOutput);
                analysis.suggestions = this.generateSuggestions(analysis.failureType, analysis.errorMessage);
            }

            if (testFile) {
                analysis.affectedFiles.push(testFile);
                // Try to find related source files
                const relatedFiles = await this.findRelatedFiles(testFile);
                analysis.affectedFiles.push(...relatedFiles);
            }

            return this.createSuccessResponse(
                'Test failure analysis completed',
                analysis,
            );
        } catch (error) {
            return this.createErrorResponse('test_failure', error);
        }
    }

    // Helper Methods

    async executeCommand(command, args, options = {}) {
        return new Promise((resolve, reject) => {
            const { timeout = 30000, cwd = process.cwd() } = options;

            const startTime = Date.now();
            const child = spawn(command, args, {
                cwd,
                stdio: 'pipe',
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            const timeoutId = setTimeout(() => {
                child.kill('SIGTERM');
                reject(new Error(`Command timeout after ${timeout}ms`));
            }, timeout);

            child.on('close', (code) => {
                clearTimeout(timeoutId);
                const duration = Date.now() - startTime;

                resolve({
                    exitCode: code,
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    duration,
                });
            });

            child.on('error', (error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
        });
    }

    startBackgroundProcess(command, workingDirectory, sessionId) {
        const child = spawn('sh', ['-c', command], {
            cwd: workingDirectory,
            stdio: 'pipe',
            detached: true,
        });

        let output = '';

        child.stdout.on('data', (data) => {
            output += data.toString();
        });

        child.stderr.on('data', (data) => {
            output += data.toString();
        });

        // Store output reference
        child._output = output;

        return child;
    }

    async getBackgroundProcessOutput(session) {
        return session.process._output || '';
    }

    async hasPackageJson() {
        try {
            await fs.access('package.json');
            return true;
        } catch {
            return false;
        }
    }

    async hasJest() {
        try {
            const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
            return !!(packageJson.devDependencies?.jest
                     || packageJson.dependencies?.jest
                     || packageJson.scripts?.test?.includes('jest'));
        } catch {
            return false;
        }
    }

    parseResultContent(content, filename) {
        if (filename.endsWith('.xml')) {
            // Basic XML parsing for test results
            const matches = content.match(/<testsuite.*?tests="(\d+)".*?failures="(\d+)".*?errors="(\d+)".*?>/);
            if (matches) {
                return {
                    type: 'junit',
                    tests: parseInt(matches[1]),
                    failures: parseInt(matches[2]),
                    errors: parseInt(matches[3]),
                };
            }
        } else if (filename.endsWith('.json')) {
            try {
                return JSON.parse(content);
            } catch {
                return { type: 'json', raw: content };
            }
        }
        return { type: 'raw', content };
    }

    async extractTestSummary(testFile) {
        // Try to run a quick test summary command
        try {
            const result = await this.executeCommand('grep', ['-n', 'describe\\|it\\|test', testFile]);
            return {
                testCases: result.stdout.split('\n').length,
                file: testFile,
            };
        } catch {
            return { file: testFile, testCases: 'unknown' };
        }
    }

    detectFailureType(output) {
        if (output.includes('AssertionError') || output.includes('expect')) {
            return 'assertion';
        } if (output.includes('TypeError') || output.includes('ReferenceError')) {
            return 'runtime';
        } if (output.includes('SyntaxError')) {
            return 'syntax';
        } if (output.includes('timeout') || output.includes('Timeout')) {
            return 'timeout';
        }
        return 'unknown';
    }

    extractErrorMessage(output) {
        const lines = output.split('\n');
        for (const line of lines) {
            if (line.includes('Error:') || line.includes('Failed:')) {
                return line.trim();
            }
        }
        return 'No specific error message found';
    }

    extractStackTrace(output) {
        const lines = output.split('\n');
        const stackLines = [];
        let inStack = false;

        for (const line of lines) {
            if (line.trim().startsWith('at ') || line.includes('stack trace')) {
                inStack = true;
            }
            if (inStack) {
                stackLines.push(line.trim());
                if (stackLines.length > 10) break; // Limit stack trace
            }
        }

        return stackLines.join('\n');
    }

    generateSuggestions(failureType, errorMessage) {
        const suggestions = [];

        switch (failureType) {
            case 'assertion':
                suggestions.push('Check expected vs actual values in your assertions');
                suggestions.push('Verify test data setup and mock configurations');
                break;
            case 'runtime':
                suggestions.push('Check for undefined variables or null references');
                suggestions.push('Verify all dependencies are properly imported');
                break;
            case 'syntax':
                suggestions.push('Check for syntax errors in your code');
                suggestions.push('Verify proper bracket/parentheses matching');
                break;
            case 'timeout':
                suggestions.push('Increase timeout values for slow operations');
                suggestions.push('Check for infinite loops or blocking operations');
                break;
            default:
                suggestions.push('Review the full error output for more context');
                suggestions.push('Check test environment setup and dependencies');
        }

        return suggestions;
    }

    async findRelatedFiles(testFile) {
        const related = [];
        const baseName = path.basename(testFile, path.extname(testFile));
        const baseNameClean = baseName.replace(/\.test$|\.spec$/, '');

        // Look for source files
        const possibleExtensions = ['.js', '.ts', '.jsx', '.tsx'];
        for (const ext of possibleExtensions) {
            const sourceFile = path.join(path.dirname(testFile), baseNameClean + ext);
            try {
                await fs.access(sourceFile);
                related.push(sourceFile);
            } catch {
                // File doesn't exist
            }
        }

        return related;
    }
}

// Start the server
const server = new TestExecutionServer();
server.run().catch(console.error);
