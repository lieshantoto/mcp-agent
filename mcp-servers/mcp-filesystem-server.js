#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import { BaseMCPServer, CommonSchemas, FileUtils } from './base-mcp-server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * File System MCP Server
 * Provides essential file system operations for test automation and code analysis
 */
class FileSystemMCPServer extends BaseMCPServer {
    constructor() {
        const serverInfo = {
            name: 'filesystem-mcp-server',
            version: '1.0.0',
            description: 'File system operations for test automation - 8 essential tools',
        };

        const tools = [
            {
                name: 'file_search',
                description: 'Search for files using glob patterns (e.g., **/*.feature, **/*.js)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        pattern: {
                            type: 'string',
                            description: 'Glob pattern to search for files (e.g., **/*.feature, features/**/NTC-*.feature)',
                        },
                        maxResults: {
                            type: 'number',
                            description: 'Maximum number of files to return',
                            default: 100,
                        },
                        baseDir: {
                            type: 'string',
                            description: 'Base directory to search from (default: current directory)',
                        },
                    },
                    required: ['pattern'],
                },
            },
            {
                name: 'read_file',
                description: 'Read file contents with optional line range support',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filePath: CommonSchemas.filePath,
                        startLine: {
                            type: 'number',
                            description: 'Start line number (0-based, optional)',
                        },
                        endLine: {
                            type: 'number',
                            description: 'End line number (0-based, optional)',
                        },
                        encoding: {
                            type: 'string',
                            description: 'File encoding',
                            default: 'utf8',
                        },
                    },
                    required: ['filePath'],
                },
            },
            {
                name: 'list_dir',
                description: 'List directory contents with filtering options',
                inputSchema: {
                    type: 'object',
                    properties: {
                        dirPath: {
                            type: 'string',
                            description: 'Directory path to list',
                        },
                        recursive: {
                            type: 'boolean',
                            description: 'List contents recursively',
                            default: false,
                        },
                        fileFilter: {
                            type: 'string',
                            description: 'File extension filter (e.g., .js, .feature)',
                        },
                        maxDepth: {
                            type: 'number',
                            description: 'Maximum recursion depth',
                            default: 3,
                        },
                    },
                    required: ['dirPath'],
                },
            },
            {
                name: 'grep_search',
                description: 'Search for text patterns in files using regex',
                inputSchema: {
                    type: 'object',
                    properties: {
                        pattern: CommonSchemas.pattern,
                        searchPath: {
                            type: 'string',
                            description: 'Path to search in (file or directory)',
                        },
                        filePattern: {
                            type: 'string',
                            description: 'Glob pattern for files to search in (e.g., **/*.js)',
                            default: '**/*',
                        },
                        isRegex: {
                            type: 'boolean',
                            description: 'Treat pattern as regex',
                            default: false,
                        },
                        caseSensitive: {
                            type: 'boolean',
                            description: 'Case sensitive search',
                            default: false,
                        },
                        maxResults: CommonSchemas.maxResults,
                        includeLineNumbers: {
                            type: 'boolean',
                            description: 'Include line numbers in results',
                            default: true,
                        },
                    },
                    required: ['pattern', 'searchPath'],
                },
            },
            {
                name: 'create_file',
                description: 'Create a new file with specified content',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filePath: CommonSchemas.filePath,
                        content: CommonSchemas.content,
                        overwrite: {
                            type: 'boolean',
                            description: 'Overwrite existing file',
                            default: false,
                        },
                        createDirectories: {
                            type: 'boolean',
                            description: 'Create parent directories if they don\'t exist',
                            default: true,
                        },
                        encoding: {
                            type: 'string',
                            description: 'File encoding',
                            default: 'utf8',
                        },
                    },
                    required: ['filePath', 'content'],
                },
            },
            {
                name: 'semantic_search',
                description: 'Search codebase using natural language queries with relevance scoring',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'Natural language search query (e.g., "login page object", "NTC-1234 test case")',
                        },
                        searchPath: {
                            type: 'string',
                            description: 'Path to search in',
                            default: '.',
                        },
                        fileTypes: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'File extensions to search (e.g., [".js", ".feature", ".ts"])',
                            default: ['.js', '.ts', '.feature', '.json'],
                        },
                        maxResults: CommonSchemas.maxResults,
                        minScore: {
                            type: 'number',
                            description: 'Minimum relevance score (0-1)',
                            default: 0.1,
                        },
                    },
                    required: ['query'],
                },
            },
            {
                name: 'get_changed_files',
                description: 'Get list of changed files from Git repository',
                inputSchema: {
                    type: 'object',
                    properties: {
                        repositoryPath: {
                            type: 'string',
                            description: 'Path to Git repository (default: current directory)',
                            default: '.',
                        },
                        sinceCommit: {
                            type: 'string',
                            description: 'Compare changes since this commit (default: HEAD)',
                        },
                        staged: {
                            type: 'boolean',
                            description: 'Include staged changes',
                            default: true,
                        },
                        unstaged: {
                            type: 'boolean',
                            description: 'Include unstaged changes',
                            default: true,
                        },
                        includeUntracked: {
                            type: 'boolean',
                            description: 'Include untracked files',
                            default: false,
                        },
                    },
                },
            },
            {
                name: 'fetch_webpage',
                description: 'Fetch content from a webpage for documentation or reference',
                inputSchema: {
                    type: 'object',
                    properties: {
                        url: {
                            type: 'string',
                            description: 'URL to fetch content from',
                        },
                        selector: {
                            type: 'string',
                            description: 'CSS selector to extract specific content',
                        },
                        timeout: CommonSchemas.timeout,
                        userAgent: {
                            type: 'string',
                            description: 'User agent string',
                            default: 'Mozilla/5.0 (compatible; MCP-FileSystem-Bot/1.0)',
                        },
                    },
                    required: ['url'],
                },
            },
        ];

        super(serverInfo, tools);
        this.setupFileSystemHandlers();
    }

    setupFileSystemHandlers() {
        this.registerTool('file_search', this.handleFileSearch.bind(this));
        this.registerTool('read_file', this.handleReadFile.bind(this));
        this.registerTool('list_dir', this.handleListDir.bind(this));
        this.registerTool('grep_search', this.handleGrepSearch.bind(this));
        this.registerTool('create_file', this.handleCreateFile.bind(this));
        this.registerTool('semantic_search', this.handleSemanticSearch.bind(this));
        this.registerTool('get_changed_files', this.handleGetChangedFiles.bind(this));
        this.registerTool('fetch_webpage', this.handleFetchWebpage.bind(this));
    }

    async handleFileSearch(args) {
        try {
            this.validateRequiredParams(args, ['pattern']);

            const { pattern, maxResults = 100, baseDir = process.cwd() } = args;

            this.logInfo(`Searching for files with pattern: ${pattern}`);

            const files = await glob(pattern, {
                cwd: baseDir,
                absolute: true,
                nodir: true,
            });

            const limitedFiles = files.slice(0, maxResults);

            this.logSuccess(`Found ${files.length} files (showing ${limitedFiles.length})`);

            return this.createSuccessResponse(
                `🔍 Found ${files.length} files matching pattern "${pattern}"\n\nFiles (showing first ${limitedFiles.length}):\n${limitedFiles.map((file, i) => `${i + 1}. ${file}`).join('\n')}`,
                {
                    pattern,
                    totalFound: files.length,
                    files: limitedFiles,
                    truncated: files.length > maxResults,
                },
            );
        } catch (error) {
            this.logError('File search failed', error);
            return this.createErrorResponse('file_search', error);
        }
    }

    async handleReadFile(args) {
        try {
            this.validateRequiredParams(args, ['filePath']);

            const {
                filePath, startLine, endLine, encoding = 'utf8',
            } = args;

            if (!(await FileUtils.exists(filePath))) {
                throw new Error(`File not found: ${filePath}`);
            }

            this.logInfo(`Reading file: ${filePath}`);

            const content = await fs.readFile(filePath, encoding);
            const lines = content.split('\n');

            let selectedLines = lines;
            let rangeInfo = '';

            if (startLine !== undefined || endLine !== undefined) {
                const start = startLine || 0;
                const end = endLine !== undefined ? endLine + 1 : lines.length;
                selectedLines = lines.slice(start, end);
                rangeInfo = ` (lines ${start}-${end - 1})`;
            }

            const result = selectedLines.join('\n');

            this.logSuccess(`Read ${selectedLines.length} lines from ${path.basename(filePath)}`);

            return this.createSuccessResponse(
                `📄 File content: ${filePath}${rangeInfo}\n\n${result}`,
                {
                    filePath,
                    totalLines: lines.length,
                    selectedLines: selectedLines.length,
                    range: { start: startLine || 0, end: endLine || lines.length - 1 },
                },
            );
        } catch (error) {
            this.logError('File read failed', error);
            return this.createErrorResponse('read_file', error);
        }
    }

    async handleListDir(args) {
        try {
            this.validateRequiredParams(args, ['dirPath']);

            const {
                dirPath, recursive = false, fileFilter, maxDepth = 3,
            } = args;

            if (!(await FileUtils.exists(dirPath))) {
                throw new Error(`Directory not found: ${dirPath}`);
            }

            this.logInfo(`Listing directory: ${dirPath} (recursive: ${recursive})`);

            const items = await this.listDirectoryContents(dirPath, recursive, fileFilter, maxDepth, 0);

            const files = items.filter((item) => item.type === 'file');
            const dirs = items.filter((item) => item.type === 'directory');

            this.logSuccess(`Found ${items.length} items (${files.length} files, ${dirs.length} directories)`);

            const formattedItems = items.map((item) => {
                const icon = item.type === 'file' ? '📄' : '📁';
                const indent = '  '.repeat(item.depth);
                return `${indent}${icon} ${item.name}`;
            }).join('\n');

            return this.createSuccessResponse(
                `📁 Directory listing: ${dirPath}\n\n${formattedItems}`,
                {
                    dirPath,
                    totalItems: items.length,
                    files: files.length,
                    directories: dirs.length,
                    items,
                },
            );
        } catch (error) {
            this.logError('Directory listing failed', error);
            return this.createErrorResponse('list_dir', error);
        }
    }

    async listDirectoryContents(dirPath, recursive, fileFilter, maxDepth, currentDepth) {
        if (currentDepth >= maxDepth) return [];

        const items = [];
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const relativeName = path.relative(process.cwd(), fullPath);

            if (entry.isDirectory()) {
                items.push({
                    name: relativeName,
                    type: 'directory',
                    path: fullPath,
                    depth: currentDepth,
                });

                if (recursive) {
                    const subItems = await this.listDirectoryContents(fullPath, recursive, fileFilter, maxDepth, currentDepth + 1);
                    items.push(...subItems);
                }
            } else if (!fileFilter || entry.name.endsWith(fileFilter)) {
                items.push({
                    name: relativeName,
                    type: 'file',
                    path: fullPath,
                    depth: currentDepth,
                });
            }
        }

        return items;
    }

    async handleGrepSearch(args) {
        try {
            this.validateRequiredParams(args, ['pattern', 'searchPath']);

            const {
                pattern,
                searchPath,
                filePattern = '**/*',
                isRegex = false,
                caseSensitive = false,
                maxResults = 100,
                includeLineNumbers = true,
            } = args;

            this.logInfo(`Searching for pattern: ${pattern} in ${searchPath}`);

            const results = await this.searchInFiles(pattern, searchPath, filePattern, isRegex, caseSensitive, maxResults, includeLineNumbers);

            this.logSuccess(`Found ${results.length} matches`);

            const formattedResults = results.map((result) => {
                const lineInfo = includeLineNumbers ? `:${result.lineNumber}` : '';
                return `📄 ${result.file}${lineInfo}\n   ${result.line.trim()}`;
            }).join('\n\n');

            return this.createSuccessResponse(
                `🔍 Search results for "${pattern}" in ${searchPath}\n\n${formattedResults}`,
                {
                    pattern,
                    searchPath,
                    totalMatches: results.length,
                    results,
                },
            );
        } catch (error) {
            this.logError('Grep search failed', error);
            return this.createErrorResponse('grep_search', error);
        }
    }

    async searchInFiles(pattern, searchPath, filePattern, isRegex, caseSensitive, maxResults, includeLineNumbers) {
        const results = [];
        const regex = isRegex
            ? new RegExp(pattern, caseSensitive ? 'g' : 'gi')
            : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi');

        const searchFiles = await glob(filePattern, {
            cwd: searchPath,
            absolute: true,
            nodir: true,
        });

        for (const file of searchFiles) {
            if (results.length >= maxResults) break;

            try {
                const content = await fs.readFile(file, 'utf8');
                const lines = content.split('\n');

                for (let i = 0; i < lines.length && results.length < maxResults; i++) {
                    if (regex.test(lines[i])) {
                        results.push({
                            file: path.relative(process.cwd(), file),
                            lineNumber: i + 1,
                            line: lines[i],
                            match: lines[i].match(regex)?.[0] || pattern,
                        });
                    }
                }
            } catch (err) {
                // Skip files that can't be read
                continue;
            }
        }

        return results;
    }

    async handleCreateFile(args) {
        try {
            this.validateRequiredParams(args, ['filePath', 'content']);

            const {
                filePath, content, overwrite = false, createDirectories = true, encoding = 'utf8',
            } = args;

            if (!overwrite && await FileUtils.exists(filePath)) {
                throw new Error(`File already exists: ${filePath} (use overwrite: true to overwrite)`);
            }

            if (createDirectories) {
                const dir = path.dirname(filePath);
                await FileUtils.ensureDir(dir);
            }

            this.logInfo(`Creating file: ${filePath}`);

            await fs.writeFile(filePath, content, encoding);

            const stats = await FileUtils.getStats(filePath);

            this.logSuccess(`Created file: ${path.basename(filePath)} (${stats.size} bytes)`);

            return this.createSuccessResponse(
                `✅ File created successfully: ${filePath}\nSize: ${stats.size} bytes\nLines: ${content.split('\n').length}`,
                {
                    filePath,
                    size: stats.size,
                    lines: content.split('\n').length,
                    created: true,
                },
            );
        } catch (error) {
            this.logError('File creation failed', error);
            return this.createErrorResponse('create_file', error);
        }
    }

    async handleSemanticSearch(args) {
        try {
            this.validateRequiredParams(args, ['query']);

            const {
                query,
                searchPath = '.',
                fileTypes = ['.js', '.ts', '.feature', '.json'],
                maxResults = 100,
                minScore = 0.1,
            } = args;

            this.logInfo(`Semantic search for: "${query}"`);

            const results = await this.performSemanticSearch(query, searchPath, fileTypes, maxResults, minScore);

            this.logSuccess(`Found ${results.length} relevant matches`);

            const formattedResults = results.map((result, i) => `${i + 1}. 📄 ${result.file} (score: ${result.score.toFixed(2)})\n   ${result.snippet}`).join('\n\n');

            return this.createSuccessResponse(
                `🧠 Semantic search results for "${query}"\n\n${formattedResults}`,
                {
                    query,
                    totalResults: results.length,
                    results,
                },
            );
        } catch (error) {
            this.logError('Semantic search failed', error);
            return this.createErrorResponse('semantic_search', error);
        }
    }

    async performSemanticSearch(query, searchPath, fileTypes, maxResults, minScore) {
        const results = [];
        const queryTerms = query.toLowerCase().split(/\s+/);

        // Build file pattern from file types
        const patterns = fileTypes.map((ext) => `**/*${ext}`);
        const allFiles = [];

        for (const pattern of patterns) {
            const files = await glob(pattern, {
                cwd: searchPath,
                absolute: true,
                nodir: true,
            });
            allFiles.push(...files);
        }

        for (const file of allFiles) {
            try {
                const content = await fs.readFile(file, 'utf8');
                const score = this.calculateRelevanceScore(content, queryTerms);

                if (score >= minScore) {
                    const snippet = this.extractRelevantSnippet(content, queryTerms);
                    results.push({
                        file: path.relative(process.cwd(), file),
                        score,
                        snippet,
                        path: file,
                    });
                }
            } catch (err) {
                // Skip files that can't be read
                continue;
            }
        }

        // Sort by relevance score and limit results
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults);
    }

    calculateRelevanceScore(content, queryTerms) {
        const lowerContent = content.toLowerCase();
        const words = lowerContent.split(/\s+/);
        const wordCount = words.length;

        let score = 0;
        let termMatches = 0;

        for (const term of queryTerms) {
            const matches = (lowerContent.match(new RegExp(term, 'g')) || []).length;
            if (matches > 0) {
                termMatches++;
                score += (matches / wordCount) * 10; // Weight by frequency
            }
        }

        // Bonus for matching more terms
        score += (termMatches / queryTerms.length) * 5;

        // Bonus for matches in filenames
        const fileName = path.basename(content).toLowerCase();
        for (const term of queryTerms) {
            if (fileName.includes(term)) {
                score += 2;
            }
        }

        return Math.min(score, 1); // Cap at 1.0
    }

    extractRelevantSnippet(content, queryTerms) {
        const lines = content.split('\n');
        let bestLine = '';
        let maxMatches = 0;

        for (const line of lines) {
            const lowerLine = line.toLowerCase();
            let matches = 0;

            for (const term of queryTerms) {
                if (lowerLine.includes(term)) {
                    matches++;
                }
            }

            if (matches > maxMatches) {
                maxMatches = matches;
                bestLine = line.trim();
            }
        }

        return bestLine || lines[0]?.trim() || 'No relevant snippet found';
    }

    async handleGetChangedFiles(args) {
        try {
            const {
                repositoryPath = '.',
                sinceCommit,
                staged = true,
                unstaged = true,
                includeUntracked = false,
            } = args;

            this.logInfo(`Getting changed files from Git repository: ${repositoryPath}`);

            const { spawn } = await import('child_process');
            const changes = await this.getGitChanges(repositoryPath, sinceCommit, staged, unstaged, includeUntracked);

            this.logSuccess(`Found ${changes.length} changed files`);

            const formattedChanges = changes.map((change) => `${this.getChangeIcon(change.status)} ${change.file} (${change.status})`).join('\n');

            return this.createSuccessResponse(
                `📝 Git changes in ${repositoryPath}\n\n${formattedChanges}`,
                {
                    repositoryPath,
                    totalChanges: changes.length,
                    changes,
                },
            );
        } catch (error) {
            this.logError('Get changed files failed', error);
            return this.createErrorResponse('get_changed_files', error);
        }
    }

    async getGitChanges(repositoryPath, sinceCommit, staged, unstaged, includeUntracked) {
        const { execSync } = await import('child_process');
        const changes = [];

        try {
            // Get staged changes
            if (staged) {
                const stagedOutput = execSync('git diff --cached --name-status', {
                    cwd: repositoryPath,
                    encoding: 'utf8',
                });
                changes.push(...this.parseGitStatus(stagedOutput, 'staged'));
            }

            // Get unstaged changes
            if (unstaged) {
                const unstagedOutput = execSync('git diff --name-status', {
                    cwd: repositoryPath,
                    encoding: 'utf8',
                });
                changes.push(...this.parseGitStatus(unstagedOutput, 'unstaged'));
            }

            // Get untracked files
            if (includeUntracked) {
                const untrackedOutput = execSync('git ls-files --others --exclude-standard', {
                    cwd: repositoryPath,
                    encoding: 'utf8',
                });
                const untrackedFiles = untrackedOutput.trim().split('\n').filter((f) => f);
                changes.push(...untrackedFiles.map((file) => ({
                    file,
                    status: 'untracked',
                    type: 'untracked',
                })));
            }

            return changes;
        } catch (error) {
            throw new Error(`Git operation failed: ${error.message}`);
        }
    }

    parseGitStatus(output, type) {
        return output.trim().split('\n')
            .filter((line) => line)
            .map((line) => {
                const [status, file] = line.split('\t');
                return {
                    file,
                    status,
                    type,
                };
            });
    }

    getChangeIcon(status) {
        const icons = {
            A: '➕', // Added
            M: '📝', // Modified
            D: '❌', // Deleted
            R: '🔄', // Renamed
            C: '📋', // Copied
            U: '🔀', // Unmerged
            untracked: '❓', // Untracked
        };
        return icons[status] || '📄';
    }

    async handleFetchWebpage(args) {
        try {
            this.validateRequiredParams(args, ['url']);

            const {
                url, selector, timeout = 30000, userAgent,
            } = args;

            this.logInfo(`Fetching webpage: ${url}`);

            // Dynamic import for HTTP requests
            const response = await fetch(url, {
                headers: userAgent ? { 'User-Agent': userAgent } : {},
                signal: AbortSignal.timeout(timeout),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();
            let content = html;

            // If selector is provided, extract specific content
            if (selector) {
                const { JSDOM } = await import('jsdom');
                const dom = new JSDOM(html);
                const element = dom.window.document.querySelector(selector);
                content = element ? element.textContent : 'Selector not found';
            }

            // Limit content length for response
            const maxLength = 5000;
            const truncated = content.length > maxLength;
            const displayContent = truncated ? `${content.substring(0, maxLength)}...` : content;

            this.logSuccess(`Fetched ${content.length} characters from ${url}`);

            return this.createSuccessResponse(
                `🌐 Webpage content from ${url}\n\n${displayContent}`,
                {
                    url,
                    contentLength: content.length,
                    truncated,
                    selector: selector || null,
                },
            );
        } catch (error) {
            this.logError('Webpage fetch failed', error);
            return this.createErrorResponse('fetch_webpage', error);
        }
    }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const server = new FileSystemMCPServer();
    server.start().catch(console.error);
}

export default FileSystemMCPServer;
