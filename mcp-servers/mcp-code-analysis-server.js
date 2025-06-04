#!/usr/bin/env node

/**
 * MCP Code Analysis Server
 * Handles code analysis, error detection, and code search operations
 *
 * Tools: get_errors, list_code_usages, test_search, get_search_view_results, github_repo, notebook_list_packages
 */

import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { BaseMCPServer } from './base-mcp-server.js';

class CodeAnalysisServer extends BaseMCPServer {
    constructor() {
        super({
            name: 'mcp-code-analysis-server',
            version: '1.0.0',
            description: 'Code analysis, error detection, and search operations',
        });

        this.searchCache = new Map();
        this.registerTools();
    }

    registerTools() {
        // Register tool schemas
        this.addTool({
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
                },
                required: ['filePaths'],
            },
        });

        this.addTool({
            name: 'list_code_usages',
            description: 'List all usages (references, definitions, implementations etc) of a function, class, method, variable etc',
            inputSchema: {
                type: 'object',
                properties: {
                    symbolName: {
                        type: 'string',
                        description: 'The name of the symbol, such as a function name, class name, method name, variable name, etc.',
                    },
                    filePaths: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'One or more file paths which likely contain the definition of the symbol',
                    },
                },
                required: ['symbolName'],
            },
        });

        this.addTool({
            name: 'test_search',
            description: 'For a source code file, find the file that contains the tests. For a test file find the file that contains the code under test',
            inputSchema: {
                type: 'object',
                properties: {
                    filePaths: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Array of file paths to search for related test files',
                    },
                },
                required: ['filePaths'],
            },
        });

        this.addTool({
            name: 'get_search_view_results',
            description: 'Get the results from the search view',
            inputSchema: {
                type: 'object',
                properties: {},
            },
        });

        this.addTool({
            name: 'github_repo',
            description: 'Search a GitHub repository for relevant source code snippets',
            inputSchema: {
                type: 'object',
                properties: {
                    repo: {
                        type: 'string',
                        description: 'The name of the Github repository to search for code in. Must be formatted as "<owner>/<repo>"',
                    },
                    query: {
                        type: 'string',
                        description: 'The query to search for repo. Should contain all relevant context',
                    },
                },
                required: ['repo', 'query'],
            },
        });

        this.addTool({
            name: 'notebook_list_packages',
            description: 'List the installed packages that are currently available in the selected kernel for a notebook editor',
            inputSchema: {
                type: 'object',
                properties: {
                    filePath: {
                        type: 'string',
                        description: 'The absolute path of the notebook with the active kernel',
                    },
                },
                required: ['filePath'],
            },
        });

        // Register tool handlers
        this.registerTool('get_errors', this.getErrors.bind(this));
        this.registerTool('list_code_usages', this.listCodeUsages.bind(this));
        this.registerTool('test_search', this.testSearch.bind(this));
        this.registerTool('get_search_view_results', this.getSearchViewResults.bind(this));
        this.registerTool('github_repo', this.githubRepo.bind(this));
        this.registerTool('notebook_list_packages', this.notebookListPackages.bind(this));
    }

    async getErrors(args) {
        try {
            this.validateRequiredParams(args, ['filePaths']);

            const { filePaths } = args;
            const errors = [];

            for (const filePath of filePaths) {
                try {
                    const fileErrors = await this.analyzeFileErrors(filePath);
                    if (fileErrors.length > 0) {
                        errors.push({
                            file: filePath,
                            errors: fileErrors,
                        });
                    }
                } catch (error) {
                    errors.push({
                        file: filePath,
                        errors: [{
                            type: 'file_error',
                            message: `Cannot analyze file: ${error.message}`,
                            line: 0,
                            column: 0,
                        }],
                    });
                }
            }

            return this.createSuccessResponse(
                `Error analysis completed for ${filePaths.length} files`,
                {
                    totalFiles: filePaths.length,
                    filesWithErrors: errors.length,
                    errors,
                },
            );
        } catch (error) {
            return this.createErrorResponse('get_errors', error);
        }
    }

    async listCodeUsages(args) {
        try {
            this.validateRequiredParams(args, ['symbolName']);

            const { symbolName, filePaths = [] } = args;
            const usages = [];

            // If specific files are provided, search in those
            if (filePaths.length > 0) {
                for (const filePath of filePaths) {
                    const fileUsages = await this.findSymbolInFile(symbolName, filePath);
                    usages.push(...fileUsages);
                }
            } else {
                // Search in entire workspace
                const workspaceUsages = await this.findSymbolInWorkspace(symbolName);
                usages.push(...workspaceUsages);
            }

            // Group usages by type
            const grouped = {
                definitions: usages.filter((u) => u.type === 'definition'),
                references: usages.filter((u) => u.type === 'reference'),
                implementations: usages.filter((u) => u.type === 'implementation'),
            };

            return this.createSuccessResponse(
                `Found ${usages.length} usages of '${symbolName}'`,
                {
                    symbolName,
                    totalUsages: usages.length,
                    grouped,
                    allUsages: usages,
                },
            );
        } catch (error) {
            return this.createErrorResponse('list_code_usages', error);
        }
    }

    async testSearch(args) {
        try {
            this.validateRequiredParams(args, ['filePaths']);

            const { filePaths } = args;
            const results = [];

            for (const filePath of filePaths) {
                const isTestFile = this.isTestFile(filePath);

                if (isTestFile) {
                    // Find the source file for this test
                    const sourceFiles = await this.findSourceFileForTest(filePath);
                    results.push({
                        type: 'test_file',
                        file: filePath,
                        relatedFiles: sourceFiles,
                    });
                } else {
                    // Find tests for this source file
                    const testFiles = await this.findTestsForSource(filePath);
                    results.push({
                        type: 'source_file',
                        file: filePath,
                        relatedFiles: testFiles,
                    });
                }
            }

            return this.createSuccessResponse(
                `Test search completed for ${filePaths.length} files`,
                {
                    results,
                },
            );
        } catch (error) {
            return this.createErrorResponse('test_search', error);
        }
    }

    async getSearchViewResults(args) {
        try {
            // Return cached search results from VS Code search view
            const results = Array.from(this.searchCache.values()).map((result) => ({
                query: result.query,
                timestamp: result.timestamp,
                matches: result.matches,
                totalMatches: result.totalMatches,
            }));

            return this.createSuccessResponse(
                `Retrieved ${results.length} search view results`,
                {
                    results,
                    totalQueries: results.length,
                },
            );
        } catch (error) {
            return this.createErrorResponse('get_search_view_results', error);
        }
    }

    async githubRepo(args) {
        try {
            this.validateRequiredParams(args, ['repo', 'query']);

            const { repo, query } = args;

            // Note: This is a simulated GitHub search since we can't make actual API calls
            // In a real implementation, you would use the GitHub API
            const searchResults = {
                repository: repo,
                query,
                message: 'This is a simulated GitHub search result. In a real implementation, this would use the GitHub API to search code.',
                suggestions: [
                    `Search for "${query}" in the GitHub web interface`,
                    `Use GitHub CLI: gh search code "${query}" --repo ${repo}`,
                    'Clone the repository and use local search tools',
                ],
            };

            return this.createSuccessResponse(
                `GitHub search simulation for ${repo}`,
                searchResults,
            );
        } catch (error) {
            return this.createErrorResponse('github_repo', error);
        }
    }

    async notebookListPackages(args) {
        try {
            this.validateRequiredParams(args, ['filePath']);

            const { filePath } = args;

            // Check if it's a notebook file
            if (!filePath.endsWith('.ipynb')) {
                throw new Error('File must be a Jupyter notebook (.ipynb)');
            }

            // Read notebook content
            const notebookContent = await fs.readFile(filePath, 'utf8');
            const notebook = JSON.parse(notebookContent);

            // Extract imports and packages from code cells
            const packages = new Set();
            const imports = [];

            for (const cell of notebook.cells) {
                if (cell.cell_type === 'code' && cell.source) {
                    const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;

                    // Find import statements
                    const importMatches = source.match(/^(?:import|from)\s+([^\s]+)/gm) || [];
                    for (const match of importMatches) {
                        const packageName = match.replace(/^(?:import|from)\s+/, '').split('.')[0];
                        packages.add(packageName);
                        imports.push({
                            statement: match.trim(),
                            package: packageName,
                        });
                    }

                    // Find pip install commands
                    const pipMatches = source.match(/!pip install ([^\n]+)/g) || [];
                    for (const match of pipMatches) {
                        const packageNames = match.replace('!pip install ', '').split(' ');
                        packageNames.forEach((pkg) => packages.add(pkg.trim()));
                    }
                }
            }

            return this.createSuccessResponse(
                `Package analysis completed for ${filePath}`,
                {
                    notebookFile: filePath,
                    totalPackages: packages.size,
                    packages: Array.from(packages),
                    imports,
                    cellCount: notebook.cells.length,
                    codeCell: notebook.cells.filter((c) => c.cell_type === 'code').length,
                },
            );
        } catch (error) {
            return this.createErrorResponse('notebook_list_packages', error);
        }
    }

    // Helper Methods

    async analyzeFileErrors(filePath) {
        const errors = [];
        const ext = path.extname(filePath);

        try {
            const content = await fs.readFile(filePath, 'utf8');

            // Basic syntax analysis based on file type
            switch (ext) {
                case '.js':
                case '.jsx':
                case '.ts':
                case '.tsx':
                    errors.push(...await this.analyzeJavaScriptErrors(filePath, content));
                    break;
                case '.py':
                    errors.push(...await this.analyzePythonErrors(filePath, content));
                    break;
                case '.json':
                    errors.push(...this.analyzeJsonErrors(filePath, content));
                    break;
                default:
                    // Generic text analysis
                    errors.push(...this.analyzeGenericErrors(filePath, content));
            }
        } catch (error) {
            errors.push({
                type: 'file_access_error',
                message: error.message,
                line: 0,
                column: 0,
            });
        }

        return errors;
    }

    async analyzeJavaScriptErrors(filePath, content) {
        const errors = [];

        try {
            // Try to use ESLint if available
            const result = await this.executeCommand('npx', ['eslint', '--format', 'json', filePath]);
            if (result.stdout) {
                const eslintResults = JSON.parse(result.stdout);
                for (const fileResult of eslintResults) {
                    for (const message of fileResult.messages) {
                        errors.push({
                            type: message.severity === 2 ? 'error' : 'warning',
                            message: message.message,
                            line: message.line,
                            column: message.column,
                            rule: message.ruleId,
                        });
                    }
                }
            }
        } catch {
            // ESLint not available, do basic analysis
            errors.push(...this.basicJavaScriptAnalysis(content));
        }

        return errors;
    }

    async analyzePythonErrors(filePath, content) {
        const errors = [];

        try {
            // Try to compile Python code
            const result = await this.executeCommand('python', ['-m', 'py_compile', filePath]);
            if (result.stderr) {
                const pythonError = this.parsePythonError(result.stderr);
                if (pythonError) {
                    errors.push(pythonError);
                }
            }
        } catch {
            // Python not available or other error
            errors.push(...this.basicPythonAnalysis(content));
        }

        return errors;
    }

    analyzeJsonErrors(filePath, content) {
        const errors = [];

        try {
            JSON.parse(content);
        } catch (error) {
            const match = error.message.match(/at position (\d+)/);
            const position = match ? parseInt(match[1]) : 0;
            const lines = content.substring(0, position).split('\n');

            errors.push({
                type: 'syntax_error',
                message: error.message,
                line: lines.length,
                column: lines[lines.length - 1].length,
            });
        }

        return errors;
    }

    analyzeGenericErrors(filePath, content) {
        const errors = [];
        const lines = content.split('\n');

        // Look for common issues
        lines.forEach((line, index) => {
            // Check for very long lines
            if (line.length > 120) {
                errors.push({
                    type: 'style_warning',
                    message: `Line too long (${line.length} characters)`,
                    line: index + 1,
                    column: 120,
                });
            }

            // Check for trailing whitespace
            if (line.endsWith(' ') || line.endsWith('\t')) {
                errors.push({
                    type: 'style_warning',
                    message: 'Trailing whitespace',
                    line: index + 1,
                    column: line.length,
                });
            }
        });

        return errors;
    }

    basicJavaScriptAnalysis(content) {
        const errors = [];
        const lines = content.split('\n');

        lines.forEach((line, index) => {
            // Check for common issues
            if (line.includes('console.log') && !line.includes('//')) {
                errors.push({
                    type: 'warning',
                    message: 'Console.log statement found',
                    line: index + 1,
                    column: line.indexOf('console.log'),
                });
            }
        });

        return errors;
    }

    basicPythonAnalysis(content) {
        const errors = [];
        const lines = content.split('\n');

        lines.forEach((line, index) => {
            // Check for common issues
            if (line.includes('print(') && !line.trim().startsWith('#')) {
                errors.push({
                    type: 'warning',
                    message: 'Print statement found',
                    line: index + 1,
                    column: line.indexOf('print('),
                });
            }
        });

        return errors;
    }

    async findSymbolInFile(symbolName, filePath) {
        const usages = [];

        try {
            const content = await fs.readFile(filePath, 'utf8');
            const lines = content.split('\n');

            lines.forEach((line, index) => {
                let columnIndex = 0;
                while ((columnIndex = line.indexOf(symbolName, columnIndex)) !== -1) {
                    const type = this.determineUsageType(line, symbolName, columnIndex);
                    usages.push({
                        file: filePath,
                        line: index + 1,
                        column: columnIndex + 1,
                        type,
                        context: line.trim(),
                    });
                    columnIndex += symbolName.length;
                }
            });
        } catch (error) {
            console.warn(`Could not search in ${filePath}: ${error.message}`);
        }

        return usages;
    }

    async findSymbolInWorkspace(symbolName) {
        const usages = [];

        try {
            // Use grep to search for the symbol
            const result = await this.executeCommand('grep', [
                '-rn',
                '--include=*.js',
                '--include=*.ts',
                '--include=*.jsx',
                '--include=*.tsx',
                '--include=*.py',
                symbolName,
                '.',
            ]);

            const lines = result.stdout.split('\n');
            for (const line of lines) {
                if (line.trim()) {
                    const parts = line.split(':');
                    if (parts.length >= 3) {
                        const file = parts[0];
                        const lineNum = parseInt(parts[1]);
                        const content = parts.slice(2).join(':');
                        const columnIndex = content.indexOf(symbolName);

                        usages.push({
                            file,
                            line: lineNum,
                            column: columnIndex + 1,
                            type: this.determineUsageType(content, symbolName, columnIndex),
                            context: content.trim(),
                        });
                    }
                }
            }
        } catch (error) {
            console.warn(`Workspace search failed: ${error.message}`);
        }

        return usages;
    }

    determineUsageType(line, symbolName, columnIndex) {
        const beforeSymbol = line.substring(0, columnIndex);
        const afterSymbol = line.substring(columnIndex + symbolName.length);

        // Check for definitions
        if (beforeSymbol.includes('function ')
            || beforeSymbol.includes('class ')
            || beforeSymbol.includes('const ')
            || beforeSymbol.includes('let ')
            || beforeSymbol.includes('var ')
            || beforeSymbol.includes('def ')) {
            return 'definition';
        }

        // Check for implementations (method definitions)
        if (afterSymbol.startsWith('(') || afterSymbol.startsWith(' =')) {
            return 'implementation';
        }

        return 'reference';
    }

    isTestFile(filePath) {
        const fileName = path.basename(filePath);
        return fileName.includes('.test.')
               || fileName.includes('.spec.')
               || fileName.startsWith('test_')
               || filePath.includes('/test/')
               || filePath.includes('/tests/')
               || filePath.includes('/__tests__/');
    }

    async findSourceFileForTest(testFilePath) {
        const sourceFiles = [];
        const testBaseName = path.basename(testFilePath)
            .replace(/\.test\.|\.spec\./, '.')
            .replace(/^test_/, '');

        const testDir = path.dirname(testFilePath);
        const possibleDirs = [
            testDir.replace('/test/', '/src/'),
            testDir.replace('/tests/', '/src/'),
            testDir.replace('/__tests__/', '/'),
            path.join(testDir, '..', 'src'),
            path.join(testDir, '..'),
        ];

        for (const dir of possibleDirs) {
            const sourcePath = path.join(dir, testBaseName);
            try {
                await fs.access(sourcePath);
                sourceFiles.push(sourcePath);
            } catch {
                // File doesn't exist
            }
        }

        return sourceFiles;
    }

    async findTestsForSource(sourceFilePath) {
        const testFiles = [];
        const sourceBaseName = path.basename(sourceFilePath);
        const sourceDir = path.dirname(sourceFilePath);

        const testPatterns = [
            sourceBaseName.replace(/\.([^.]+)$/, '.test.$1'),
            sourceBaseName.replace(/\.([^.]+)$/, '.spec.$1'),
            `test_${sourceBaseName}`,
        ];

        const possibleDirs = [
            sourceDir.replace('/src/', '/test/'),
            sourceDir.replace('/src/', '/tests/'),
            path.join(sourceDir, '__tests__'),
            path.join(sourceDir, 'test'),
            path.join(sourceDir, 'tests'),
        ];

        for (const dir of possibleDirs) {
            for (const pattern of testPatterns) {
                const testPath = path.join(dir, pattern);
                try {
                    await fs.access(testPath);
                    testFiles.push(testPath);
                } catch {
                    // File doesn't exist
                }
            }
        }

        return testFiles;
    }

    async executeCommand(command, args, options = {}) {
        return new Promise((resolve, reject) => {
            const { timeout = 10000, cwd = process.cwd() } = options;

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
                resolve({
                    exitCode: code,
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                });
            });

            child.on('error', (error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
        });
    }

    parsePythonError(stderr) {
        const lines = stderr.split('\n');
        for (const line of lines) {
            const match = line.match(/File "([^"]+)", line (\d+)/);
            if (match) {
                return {
                    type: 'syntax_error',
                    message: line,
                    line: parseInt(match[2]),
                    column: 0,
                };
            }
        }
        return null;
    }
}

// Start the server
const server = new CodeAnalysisServer();
server.run().catch(console.error);
