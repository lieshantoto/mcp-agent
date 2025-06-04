#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { BaseMCPServer, CommonSchemas, FileUtils } from './base-mcp-server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Code Modification MCP Server
 * Provides code editing and modification tools for test repair automation
 */
class CodeModificationMCPServer extends BaseMCPServer {
    constructor() {
        const serverInfo = {
            name: 'code-modification-mcp-server',
            version: '1.0.0',
            description: 'Code modification tools for test repair - 4 critical tools',
        };

        const tools = [
            {
                name: 'replace_string_in_file',
                description: 'Replace specific string occurrences in a file with new content',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filePath: CommonSchemas.filePath,
                        oldString: {
                            type: 'string',
                            description: 'String to be replaced (must match exactly)',
                        },
                        newString: {
                            type: 'string',
                            description: 'Replacement string',
                        },
                        replaceAll: {
                            type: 'boolean',
                            description: 'Replace all occurrences (default: first occurrence only)',
                            default: false,
                        },
                        createBackup: {
                            type: 'boolean',
                            description: 'Create backup file before modification',
                            default: true,
                        },
                        validateChange: {
                            type: 'boolean',
                            description: 'Validate that the replacement was successful',
                            default: true,
                        },
                    },
                    required: ['filePath', 'oldString', 'newString'],
                },
            },
            {
                name: 'insert_edit_into_file',
                description: 'Insert new code into an existing file with smart positioning',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filePath: CommonSchemas.filePath,
                        code: {
                            type: 'string',
                            description: 'Code to insert',
                        },
                        insertPosition: {
                            type: 'string',
                            enum: ['beginning', 'end', 'after_line', 'before_line', 'after_pattern', 'before_pattern'],
                            description: 'Where to insert the code',
                            default: 'end',
                        },
                        lineNumber: {
                            type: 'number',
                            description: 'Line number for line-based insertion (0-based)',
                        },
                        pattern: {
                            type: 'string',
                            description: 'Pattern to search for when using pattern-based insertion',
                        },
                        indentLevel: {
                            type: 'number',
                            description: 'Number of spaces/tabs to indent the inserted code',
                            default: 0,
                        },
                        indentStyle: {
                            type: 'string',
                            enum: ['spaces', 'tabs'],
                            description: 'Indentation style',
                            default: 'spaces',
                        },
                        createBackup: {
                            type: 'boolean',
                            description: 'Create backup file before modification',
                            default: true,
                        },
                    },
                    required: ['filePath', 'code'],
                },
            },
            {
                name: 'run_in_terminal',
                description: 'Execute terminal commands for testing and validation',
                inputSchema: {
                    type: 'object',
                    properties: {
                        command: {
                            type: 'string',
                            description: 'Command to execute',
                        },
                        workingDirectory: {
                            type: 'string',
                            description: 'Working directory for command execution',
                            default: process.cwd(),
                        },
                        timeout: CommonSchemas.timeout,
                        captureOutput: {
                            type: 'boolean',
                            description: 'Capture command output',
                            default: true,
                        },
                        shell: {
                            type: 'string',
                            description: 'Shell to use for command execution',
                            default: '/bin/bash',
                        },
                        env: {
                            type: 'object',
                            description: 'Environment variables to set',
                        },
                    },
                    required: ['command'],
                },
            },
            {
                name: 'get_errors',
                description: 'Get compilation and syntax errors from code files',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filePaths: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Array of file paths to check for errors',
                        },
                        errorTypes: {
                            type: 'array',
                            items: {
                                type: 'string',
                                enum: ['syntax', 'lint', 'typescript', 'eslint', 'jshint'],
                            },
                            description: 'Types of errors to check for',
                            default: ['syntax', 'lint'],
                        },
                        configFile: {
                            type: 'string',
                            description: 'Path to linting configuration file',
                        },
                        maxErrors: {
                            type: 'number',
                            description: 'Maximum number of errors to return per file',
                            default: 50,
                        },
                    },
                    required: ['filePaths'],
                },
            },
        ];

        super(serverInfo, tools);
        this.setupCodeModificationHandlers();
    }

    setupCodeModificationHandlers() {
        this.registerTool('replace_string_in_file', this.handleReplaceStringInFile.bind(this));
        this.registerTool('insert_edit_into_file', this.handleInsertEditIntoFile.bind(this));
        this.registerTool('run_in_terminal', this.handleRunInTerminal.bind(this));
        this.registerTool('get_errors', this.handleGetErrors.bind(this));
    }

    async handleReplaceStringInFile(args) {
        try {
            this.validateRequiredParams(args, ['filePath', 'oldString', 'newString']);

            const {
                filePath, oldString, newString, replaceAll = false, createBackup = true, validateChange = true,
            } = args;

            if (!(await FileUtils.exists(filePath))) {
                throw new Error(`File not found: ${filePath}`);
            }

            this.logInfo(`Replacing string in file: ${filePath}`);

            // Read current content
            const originalContent = await fs.readFile(filePath, 'utf8');

            // Check if old string exists
            if (!originalContent.includes(oldString)) {
                throw new Error(`String not found in file: "${oldString}"`);
            }

            // Create backup if requested
            if (createBackup) {
                const backupPath = `${filePath}.backup.${Date.now()}`;
                await fs.writeFile(backupPath, originalContent, 'utf8');
                this.logInfo(`Backup created: ${backupPath}`);
            }

            // Perform replacement
            const newContent = replaceAll
                ? originalContent.replaceAll(oldString, newString)
                : originalContent.replace(oldString, newString);

            // Write modified content
            await fs.writeFile(filePath, newContent, 'utf8');

            // Validate change if requested
            let validationMessage = '';
            if (validateChange) {
                const updatedContent = await fs.readFile(filePath, 'utf8');
                const hasNewString = updatedContent.includes(newString);
                const hasOldString = updatedContent.includes(oldString);

                if (hasNewString && (!hasOldString || replaceAll)) {
                    validationMessage = '\n✅ Replacement validation: SUCCESS';
                } else {
                    validationMessage = '\n⚠️ Replacement validation: WARNING - string may not have been replaced correctly';
                }
            }

            const replacementCount = replaceAll
                ? (originalContent.split(oldString).length - 1)
                : 1;

            this.logSuccess(`Replaced ${replacementCount} occurrence(s) in ${path.basename(filePath)}`);

            return this.createSuccessResponse(
                `✅ String replacement successful in ${filePath}\n`
                + `Old: "${oldString}"\n`
                + `New: "${newString}"\n`
                + `Replacements: ${replacementCount}${validationMessage}`,
                {
                    filePath,
                    oldString,
                    newString,
                    replacementCount,
                    replaceAll,
                    backupCreated: createBackup,
                },
            );
        } catch (error) {
            this.logError('String replacement failed', error);
            return this.createErrorResponse('replace_string_in_file', error);
        }
    }

    async handleInsertEditIntoFile(args) {
        try {
            this.validateRequiredParams(args, ['filePath', 'code']);

            const {
                filePath,
                code,
                insertPosition = 'end',
                lineNumber,
                pattern,
                indentLevel = 0,
                indentStyle = 'spaces',
                createBackup = true,
            } = args;

            if (!(await FileUtils.exists(filePath))) {
                throw new Error(`File not found: ${filePath}`);
            }

            this.logInfo(`Inserting code into file: ${filePath} at position: ${insertPosition}`);

            // Read current content
            const originalContent = await fs.readFile(filePath, 'utf8');
            const lines = originalContent.split('\n');

            // Create backup if requested
            if (createBackup) {
                const backupPath = `${filePath}.backup.${Date.now()}`;
                await fs.writeFile(backupPath, originalContent, 'utf8');
                this.logInfo(`Backup created: ${backupPath}`);
            }

            // Prepare indentation
            const indent = indentStyle === 'tabs' ? '\t'.repeat(indentLevel) : ' '.repeat(indentLevel);
            const indentedCode = code.split('\n').map((line) => (line.trim() ? indent + line : line)).join('\n');

            // Determine insertion point
            let insertIndex = lines.length;

            switch (insertPosition) {
                case 'beginning':
                    insertIndex = 0;
                    break;

                case 'end':
                    insertIndex = lines.length;
                    break;

                case 'after_line':
                    if (lineNumber === undefined) {
                        throw new Error('lineNumber is required for after_line insertion');
                    }
                    insertIndex = Math.min(lineNumber + 1, lines.length);
                    break;

                case 'before_line':
                    if (lineNumber === undefined) {
                        throw new Error('lineNumber is required for before_line insertion');
                    }
                    insertIndex = Math.max(0, lineNumber);
                    break;

                case 'after_pattern':
                    if (!pattern) {
                        throw new Error('pattern is required for after_pattern insertion');
                    }
                    insertIndex = this.findPatternIndex(lines, pattern) + 1;
                    break;

                case 'before_pattern':
                    if (!pattern) {
                        throw new Error('pattern is required for before_pattern insertion');
                    }
                    insertIndex = this.findPatternIndex(lines, pattern);
                    break;

                default:
                    throw new Error(`Invalid insertPosition: ${insertPosition}`);
            }

            // Insert code
            const codeLines = indentedCode.split('\n');
            lines.splice(insertIndex, 0, ...codeLines);

            // Write modified content
            const newContent = lines.join('\n');
            await fs.writeFile(filePath, newContent, 'utf8');

            this.logSuccess(`Inserted ${codeLines.length} lines at position ${insertIndex}`);

            return this.createSuccessResponse(
                `✅ Code insertion successful in ${filePath}\n`
                + `Position: ${insertPosition} (line ${insertIndex})\n`
                + `Lines inserted: ${codeLines.length}\n`
                + `Indentation: ${indentLevel} ${indentStyle}`,
                {
                    filePath,
                    insertPosition,
                    insertIndex,
                    linesInserted: codeLines.length,
                    indentLevel,
                    indentStyle,
                    backupCreated: createBackup,
                },
            );
        } catch (error) {
            this.logError('Code insertion failed', error);
            return this.createErrorResponse('insert_edit_into_file', error);
        }
    }

    findPatternIndex(lines, pattern) {
        const regex = new RegExp(pattern);
        for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
                return i;
            }
        }
        throw new Error(`Pattern not found: ${pattern}`);
    }

    async handleRunInTerminal(args) {
        try {
            this.validateRequiredParams(args, ['command']);

            const {
                command,
                workingDirectory = process.cwd(),
                timeout = 30000,
                captureOutput = true,
                shell = '/bin/bash',
                env = {},
            } = args;

            this.logInfo(`Executing command: ${command}`);

            const { spawn } = await import('child_process');
            const { promisify } = await import('util');

            return new Promise((resolve, reject) => {
                const mergedEnv = { ...process.env, ...env };

                const childProcess = spawn(shell, ['-c', command], {
                    cwd: workingDirectory,
                    env: mergedEnv,
                    stdio: captureOutput ? ['pipe', 'pipe', 'pipe'] : ['inherit', 'inherit', 'inherit'],
                });

                let stdout = '';
                let stderr = '';

                if (captureOutput) {
                    childProcess.stdout?.on('data', (data) => {
                        stdout += data.toString();
                    });

                    childProcess.stderr?.on('data', (data) => {
                        stderr += data.toString();
                    });
                }

                // Set timeout
                const timeoutId = setTimeout(() => {
                    childProcess.kill('SIGTERM');
                    reject(new Error(`Command timed out after ${timeout}ms`));
                }, timeout);

                childProcess.on('close', (code) => {
                    clearTimeout(timeoutId);

                    const success = code === 0;

                    if (success) {
                        this.logSuccess(`Command executed successfully (exit code: ${code})`);
                    } else {
                        this.logError(`Command failed with exit code: ${code}`);
                    }

                    const response = this.createSuccessResponse(
                        `${success ? '✅' : '❌'} Command execution ${success ? 'successful' : 'failed'}\n`
                        + `Command: ${command}\n`
                        + `Exit Code: ${code}\n`
                        + `Working Directory: ${workingDirectory}\n\n`
                        + `STDOUT:\n${stdout}\n\n`
                        + `STDERR:\n${stderr}`,
                        {
                            command,
                            exitCode: code,
                            success,
                            stdout,
                            stderr,
                            workingDirectory,
                        },
                    );

                    resolve(response);
                });

                childProcess.on('error', (error) => {
                    clearTimeout(timeoutId);
                    this.logError('Command execution failed', error);
                    reject(error);
                });
            });
        } catch (error) {
            this.logError('Terminal execution failed', error);
            return this.createErrorResponse('run_in_terminal', error);
        }
    }

    async handleGetErrors(args) {
        try {
            this.validateRequiredParams(args, ['filePaths']);

            const {
                filePaths, errorTypes = ['syntax', 'lint'], configFile, maxErrors = 50,
            } = args;

            this.logInfo(`Checking errors in ${filePaths.length} files`);

            const allErrors = [];

            for (const filePath of filePaths) {
                if (!(await FileUtils.exists(filePath))) {
                    allErrors.push({
                        file: filePath,
                        type: 'file',
                        message: 'File not found',
                        line: 0,
                        column: 0,
                        severity: 'error',
                    });
                    continue;
                }

                const fileErrors = await this.checkFileErrors(filePath, errorTypes, configFile, maxErrors);
                allErrors.push(...fileErrors);
            }

            const errorCount = allErrors.length;
            const fileCount = filePaths.length;

            this.logInfo(`Found ${errorCount} errors across ${fileCount} files`);

            const formattedErrors = allErrors.map((error) => `${this.getErrorIcon(error.severity)} ${error.file}:${error.line}:${error.column}\n`
                + `   ${error.type}: ${error.message}`).join('\n\n');

            return this.createSuccessResponse(
                '🔍 Error analysis complete\n'
                + `Files checked: ${fileCount}\n`
                + `Total errors: ${errorCount}\n\n`
                + `${formattedErrors || 'No errors found! ✅'}`,
                {
                    filesChecked: fileCount,
                    totalErrors: errorCount,
                    errors: allErrors,
                    errorTypes,
                },
            );
        } catch (error) {
            this.logError('Error checking failed', error);
            return this.createErrorResponse('get_errors', error);
        }
    }

    async checkFileErrors(filePath, errorTypes, configFile, maxErrors) {
        const errors = [];
        const fileExtension = path.extname(filePath);

        try {
            // Basic syntax checking
            if (errorTypes.includes('syntax')) {
                const syntaxErrors = await this.checkSyntaxErrors(filePath, fileExtension);
                errors.push(...syntaxErrors);
            }

            // ESLint checking for JavaScript/TypeScript files
            if (errorTypes.includes('eslint') && ['.js', '.ts', '.jsx', '.tsx'].includes(fileExtension)) {
                const eslintErrors = await this.checkESLintErrors(filePath, configFile);
                errors.push(...eslintErrors);
            }

            // TypeScript checking
            if (errorTypes.includes('typescript') && ['.ts', '.tsx'].includes(fileExtension)) {
                const tsErrors = await this.checkTypeScriptErrors(filePath);
                errors.push(...tsErrors);
            }
        } catch (err) {
            errors.push({
                file: filePath,
                type: 'checker',
                message: `Error checking failed: ${err.message}`,
                line: 0,
                column: 0,
                severity: 'error',
            });
        }

        return errors.slice(0, maxErrors);
    }

    async checkSyntaxErrors(filePath, fileExtension) {
        const errors = [];

        try {
            const content = await fs.readFile(filePath, 'utf8');

            // JavaScript/TypeScript syntax checking
            if (['.js', '.ts', '.jsx', '.tsx'].includes(fileExtension)) {
                try {
                    // Try to parse as JavaScript
                    const { parse } = await import('@babel/parser');
                    parse(content, {
                        sourceType: 'module',
                        allowImportExportEverywhere: true,
                        plugins: ['jsx', 'typescript'],
                    });
                } catch (parseError) {
                    errors.push({
                        file: filePath,
                        type: 'syntax',
                        message: parseError.message,
                        line: parseError.loc?.line || 0,
                        column: parseError.loc?.column || 0,
                        severity: 'error',
                    });
                }
            }

            // JSON syntax checking
            if (fileExtension === '.json') {
                try {
                    JSON.parse(content);
                } catch (jsonError) {
                    errors.push({
                        file: filePath,
                        type: 'syntax',
                        message: jsonError.message,
                        line: 0,
                        column: 0,
                        severity: 'error',
                    });
                }
            }
        } catch (err) {
            // Skip files that can't be read
        }

        return errors;
    }

    async checkESLintErrors(filePath, configFile) {
        const errors = [];

        try {
            const { ESLint } = await import('eslint');
            const eslint = new ESLint({
                configFile,
                useEslintrc: !configFile,
            });

            const results = await eslint.lintFiles([filePath]);

            for (const result of results) {
                for (const message of result.messages) {
                    errors.push({
                        file: result.filePath,
                        type: 'eslint',
                        message: `${message.ruleId || 'unknown'}: ${message.message}`,
                        line: message.line,
                        column: message.column,
                        severity: message.severity === 2 ? 'error' : 'warning',
                    });
                }
            }
        } catch (err) {
            // ESLint not available or failed
            errors.push({
                file: filePath,
                type: 'eslint',
                message: `ESLint check failed: ${err.message}`,
                line: 0,
                column: 0,
                severity: 'warning',
            });
        }

        return errors;
    }

    async checkTypeScriptErrors(filePath) {
        const errors = [];

        try {
            const ts = await import('typescript');
            const content = await fs.readFile(filePath, 'utf8');

            const sourceFile = ts.createSourceFile(
                filePath,
                content,
                ts.ScriptTarget.Latest,
                true,
            );

            // Basic TypeScript syntax checking
            function visit(node) {
                // Check for basic syntax errors
                if (node.kind === ts.SyntaxKind.Unknown) {
                    errors.push({
                        file: filePath,
                        type: 'typescript',
                        message: 'Unknown syntax error',
                        line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
                        column: sourceFile.getLineAndCharacterOfPosition(node.getStart()).character + 1,
                        severity: 'error',
                    });
                }

                ts.forEachChild(node, visit);
            }

            visit(sourceFile);
        } catch (err) {
            errors.push({
                file: filePath,
                type: 'typescript',
                message: `TypeScript check failed: ${err.message}`,
                line: 0,
                column: 0,
                severity: 'warning',
            });
        }

        return errors;
    }

    getErrorIcon(severity) {
        const icons = {
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
        };
        return icons[severity] || '📄';
    }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const server = new CodeModificationMCPServer();
    server.start().catch(console.error);
}

export default CodeModificationMCPServer;
