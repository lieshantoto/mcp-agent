#!/usr/bin/env node

/**
 * Agent Mobile Planner MCP Server
 * Advanced server for fetching automation data, analyzing test scenarios, 
 * and generating comprehensive test execution plans for mobile automation
 */

import { BaseMCPServer } from './base-mcp-server.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AgentMobilePlannerServer extends BaseMCPServer {
    constructor() {
        super({
            name: 'agent-mobile-planner',
            version: '1.0.0',
            description: 'Advanced mobile automation planning and scenario analysis server for test agents',
        });
        
        this.baseProjectPath = path.resolve(__dirname, '..');
        this.featuresPath = path.join(this.baseProjectPath, 'features');
        this.scenarioDatabase = new Map();
        this.pageObjectDatabase = new Map();
        this.stepDefinitionDatabase = new Map();

        // Register tools and their handlers
        this.registerTools();
    }

    registerTools() {
        // Fetch scenario by tag
        this.addTool({
            name: 'fetch_scenario_by_tag',
            description: 'Fetch complete scenario information by NTC tag including steps, page objects, and dependencies',
            inputSchema: {
                type: 'object',
                properties: {
                    tag: {
                        type: 'string',
                        description: 'The NTC tag to search for (e.g., @NTC-43887)',
                        pattern: '^@?NTC-\\d+$'
                    },
                    includeRelatedScenarios: {
                        type: 'boolean',
                        default: false,
                        description: 'Include related scenarios from the same feature file'
                    },
                    includePageObjects: {
                        type: 'boolean',
                        default: true,
                        description: 'Include associated page object methods'
                    },
                    includeStepDefinitions: {
                        type: 'boolean',
                        default: true,
                        description: 'Include step definition implementations'
                    }
                },
                required: ['tag']
            }
        });
        this.registerTool('fetch_scenario_by_tag', this.fetchScenarioByTag.bind(this));

        // Generate execution flow
        this.addTool({
            name: 'generate_execution_flow',
            description: 'Generate detailed execution flow with automation steps for a scenario',
            inputSchema: {
                type: 'object',
                properties: {
                    tag: {
                        type: 'string',
                        description: 'The NTC tag to generate flow for'
                    },
                    platform: {
                        type: 'string',
                        enum: ['Android', 'iOS', 'both'],
                        default: 'both',
                        description: 'Target platform for execution'
                    },
                    includeAssertions: {
                        type: 'boolean',
                        default: true,
                        description: 'Include detailed assertions for each step'
                    },
                    includeErrorHandling: {
                        type: 'boolean',
                        default: true,
                        description: 'Include error handling and fallback strategies'
                    },
                    detailLevel: {
                        type: 'string',
                        enum: ['basic', 'detailed', 'comprehensive'],
                        default: 'detailed',
                        description: 'Level of detail in the execution flow'
                    }
                },
                required: ['tag']
            }
        });
        this.registerTool('generate_execution_flow', this.generateExecutionFlow.bind(this));

        // Analyze scenario dependencies
        this.addTool({
            name: 'analyze_scenario_dependencies',
            description: 'Analyze dependencies, preconditions, and related components for a scenario',
            inputSchema: {
                type: 'object',
                properties: {
                    tag: {
                        type: 'string',
                        description: 'The NTC tag to analyze'
                    },
                    includeAPICallsFlow: {
                        type: 'boolean',
                        default: true,
                        description: 'Include API setup and teardown flows'
                    },
                    includeDataRequirements: {
                        type: 'boolean',
                        default: true,
                        description: 'Include test data requirements'
                    }
                },
                required: ['tag']
            }
        });
        this.registerTool('analyze_scenario_dependencies', this.analyzeScenarioDependencies.bind(this));

        // Search scenarios by criteria
        this.addTool({
            name: 'search_scenarios',
            description: 'Search scenarios by various criteria like feature, tags, steps content',
            inputSchema: {
                type: 'object',
                properties: {
                    searchCriteria: {
                        type: 'object',
                        properties: {
                            featureName: { type: 'string' },
                            tags: { type: 'array', items: { type: 'string' } },
                            stepContains: { type: 'string' },
                            exampleData: { type: 'string' }
                        }
                    },
                    limit: {
                        type: 'number',
                        default: 10,
                        description: 'Maximum number of results to return'
                    }
                },
                required: ['searchCriteria']
            }
        });
        this.registerTool('search_scenarios', this.searchScenarios.bind(this));

        // Generate test plan
        this.addTool({
            name: 'generate_test_plan',
            description: 'Generate comprehensive test plan with execution strategy for multiple scenarios',
            inputSchema: {
                type: 'object',
                properties: {
                    scenarios: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Array of NTC tags to include in test plan'
                    },
                    executionStrategy: {
                        type: 'string',
                        enum: ['sequential', 'parallel', 'optimized'],
                        default: 'optimized',
                        description: 'Test execution strategy'
                    },
                    includeSetupTeardown: {
                        type: 'boolean',
                        default: true,
                        description: 'Include setup and teardown procedures'
                    }
                },
                required: ['scenarios']
            }
        });
        this.registerTool('generate_test_plan', this.generateTestPlan.bind(this));

        // Analyze automation gaps
        this.addTool({
            name: 'analyze_automation_gaps',
            description: 'Analyze potential automation gaps and missing implementations for scenarios',
            inputSchema: {
                type: 'object',
                properties: {
                    tag: {
                        type: 'string',
                        description: 'The NTC tag to analyze for gaps'
                    },
                    checkPageObjects: {
                        type: 'boolean',
                        default: true,
                        description: 'Check for missing page object methods'
                    },
                    checkStepDefinitions: {
                        type: 'boolean',
                        default: true,
                        description: 'Check for missing step definitions'
                    }
                },
                required: ['tag']
            }
        });
        this.registerTool('analyze_automation_gaps', this.analyzeAutomationGaps.bind(this));
    }

    async fetchScenarioByTag(args) {
        try {
            const { tag, includeRelatedScenarios, includePageObjects, includeStepDefinitions } = args;
            const normalizedTag = tag.startsWith('@') ? tag : `@${tag}`;
            
            // Find the scenario file and details
            const scenarioInfo = await this.findScenarioByTag(normalizedTag);
            
            if (!scenarioInfo) {
                return this.createErrorResponse(`Scenario with tag ${normalizedTag} not found`);
            }

            const result = {
                scenario: scenarioInfo,
                relatedComponents: {}
            };

            // Include related scenarios if requested
            if (includeRelatedScenarios) {
                result.relatedScenarios = await this.getRelatedScenarios(scenarioInfo.filePath);
            }

            // Include page objects if requested
            if (includePageObjects) {
                result.relatedComponents.pageObjects = await this.getPageObjectsForScenario(scenarioInfo);
            }

            // Include step definitions if requested
            if (includeStepDefinitions) {
                result.relatedComponents.stepDefinitions = await this.getStepDefinitionsForScenario(scenarioInfo);
            }

            return this.createSuccessResponse('Scenario fetched successfully', result);

        } catch (error) {
            return this.createErrorResponse(`Error fetching scenario: ${error.message}`);
        }
    }

    async generateExecutionFlow(args) {
        try {
            const { tag, platform, includeAssertions, includeErrorHandling, detailLevel } = args;
            const normalizedTag = tag.startsWith('@') ? tag : `@${tag}`;
            
            const scenarioInfo = await this.findScenarioByTag(normalizedTag);
            if (!scenarioInfo) {
                return this.createErrorResponse(`Scenario with tag ${normalizedTag} not found`);
            }

            const executionFlow = await this.buildExecutionFlow(
                scenarioInfo, 
                platform, 
                includeAssertions, 
                includeErrorHandling, 
                detailLevel
            );

            return this.createSuccessResponse('Execution flow generated successfully', {
                scenario: scenarioInfo,
                executionFlow,
                metadata: {
                    platform,
                    detailLevel,
                    estimatedDuration: this.calculateEstimatedDuration(executionFlow),
                    complexity: this.assessComplexity(executionFlow)
                }
            });

        } catch (error) {
            return this.createErrorResponse(`Error generating execution flow: ${error.message}`);
        }
    }

    async analyzeScenarioDependencies(args) {
        try {
            const { tag, includeAPICallsFlow, includeDataRequirements } = args;
            const normalizedTag = tag.startsWith('@') ? tag : `@${tag}`;
            
            const scenarioInfo = await this.findScenarioByTag(normalizedTag);
            if (!scenarioInfo) {
                return this.createErrorResponse(`Scenario with tag ${normalizedTag} not found`);
            }

            const dependencies = await this.analyzeDependencies(
                scenarioInfo, 
                includeAPICallsFlow, 
                includeDataRequirements
            );

            return this.createSuccessResponse('Dependencies analyzed successfully', {
                scenario: scenarioInfo,
                dependencies
            });

        } catch (error) {
            return this.createErrorResponse(`Error analyzing dependencies: ${error.message}`);
        }
    }

    async searchScenarios(args) {
        try {
            const { searchCriteria, limit } = args;
            const results = await this.performScenarioSearch(searchCriteria, limit);
            
            return this.createSuccessResponse(`Found ${results.length} scenarios`, {
                searchCriteria,
                results,
                totalFound: results.length
            });

        } catch (error) {
            return this.createErrorResponse(`Error searching scenarios: ${error.message}`);
        }
    }

    async generateTestPlan(args) {
        try {
            const { scenarios, executionStrategy, includeSetupTeardown } = args;
            const testPlan = await this.buildTestPlan(scenarios, executionStrategy, includeSetupTeardown);
            
            return this.createSuccessResponse('Test plan generated successfully', testPlan);

        } catch (error) {
            return this.createErrorResponse(`Error generating test plan: ${error.message}`);
        }
    }

    async analyzeAutomationGaps(args) {
        try {
            const { tag, checkPageObjects, checkStepDefinitions } = args;
            const normalizedTag = tag.startsWith('@') ? tag : `@${tag}`;
            
            const scenarioInfo = await this.findScenarioByTag(normalizedTag);
            if (!scenarioInfo) {
                return this.createErrorResponse(`Scenario with tag ${normalizedTag} not found`);
            }

            const gaps = await this.identifyAutomationGaps(
                scenarioInfo, 
                checkPageObjects, 
                checkStepDefinitions
            );

            return this.createSuccessResponse('Automation gaps analyzed', {
                scenario: scenarioInfo,
                gaps,
                recommendedActions: this.generateRecommendations(gaps)
            });

        } catch (error) {
            return this.createErrorResponse(`Error analyzing automation gaps: ${error.message}`);
        }
    }

    // Helper methods for scenario analysis
    async findScenarioByTag(tag) {
        const command = `grep -r "${tag}" "${this.featuresPath}" --include="*.feature"`;
        
        try {
            const { execSync } = await import('child_process');
            const output = execSync(command, { encoding: 'utf-8' });
            const lines = output.trim().split('\n');
            
            for (const line of lines) {
                const [filePath, content] = line.split(':', 2);
                if (content && content.trim() === tag) {
                    return await this.parseScenarioFromFile(filePath, tag);
                }
            }
            
            return null;
        } catch (error) {
            throw new Error(`Failed to search for tag ${tag}: ${error.message}`);
        }
    }

    async parseScenarioFromFile(filePath, tag) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.split('\n');
            
            let scenarioStart = -1;
            let scenarioEnd = -1;
            let foundTag = false;
            
            // Find the tag and associated scenario
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                if (line === tag) {
                    foundTag = true;
                    // Look backwards for scenario outline or scenario
                    for (let j = i - 1; j >= 0; j--) {
                        if (lines[j].trim().startsWith('Scenario') || lines[j].trim().startsWith('Examples:')) {
                            scenarioStart = j;
                            break;
                        }
                    }
                    
                    // Look forward for the end (next scenario or end of file)
                    for (let j = i + 1; j < lines.length; j++) {
                        if (lines[j].trim().startsWith('Scenario') || 
                            lines[j].trim().startsWith('@') && !lines[j].includes('Examples:')) {
                            scenarioEnd = j - 1;
                            break;
                        }
                    }
                    
                    if (scenarioEnd === -1) {
                        scenarioEnd = lines.length - 1;
                    }
                    break;
                }
            }
            
            if (!foundTag || scenarioStart === -1) {
                return null;
            }
            
            const scenarioLines = lines.slice(scenarioStart, scenarioEnd + 1);
            const featureMatch = content.match(/^Feature:\s*(.+)$/m);
            
            return {
                tag,
                filePath,
                featureName: featureMatch ? featureMatch[1] : 'Unknown Feature',
                scenarioContent: scenarioLines.join('\n'),
                steps: this.extractSteps(scenarioLines),
                exampleData: this.extractExampleData(scenarioLines, tag),
                metadata: this.extractMetadata(content, scenarioLines)
            };
            
        } catch (error) {
            throw new Error(`Failed to parse scenario from ${filePath}: ${error.message}`);
        }
    }

    extractSteps(scenarioLines) {
        const steps = [];
        const stepKeywords = ['Given', 'When', 'Then', 'And', 'But'];
        
        for (const line of scenarioLines) {
            const trimmed = line.trim();
            for (const keyword of stepKeywords) {
                if (trimmed.startsWith(keyword + ' ')) {
                    steps.push({
                        keyword,
                        text: trimmed.substring(keyword.length + 1),
                        fullLine: trimmed
                    });
                    break;
                }
            }
        }
        
        return steps;
    }

    extractExampleData(scenarioLines, tag) {
        let inExamples = false;
        let foundTargetTag = false;
        const exampleData = {};
        let headers = [];
        
        for (const line of scenarioLines) {
            const trimmed = line.trim();
            
            if (trimmed === tag) {
                foundTargetTag = true;
                continue;
            }
            
            if (foundTargetTag && trimmed.startsWith('Examples:')) {
                inExamples = true;
                continue;
            }
            
            if (inExamples && trimmed.startsWith('|') && trimmed.endsWith('|')) {
                const values = trimmed.split('|').map(v => v.trim()).filter(v => v);
                
                if (headers.length === 0) {
                    headers = values;
                } else {
                    for (let i = 0; i < headers.length && i < values.length; i++) {
                        exampleData[headers[i]] = values[i];
                    }
                    break; // Only get the first data row for this tag
                }
            }
            
            if (foundTargetTag && (trimmed.startsWith('@') || trimmed.startsWith('Scenario'))) {
                break;
            }
        }
        
        return exampleData;
    }

    extractMetadata(content, scenarioLines) {
        const metadata = {
            tags: [],
            featureTags: [],
            complexity: 'medium',
            dependencies: []
        };
        
        // Extract feature-level tags
        const featureTagMatch = content.match(/^(@[^\n]+)\nFeature:/m);
        if (featureTagMatch) {
            metadata.featureTags = featureTagMatch[1].split(' ').filter(tag => tag.startsWith('@'));
        }
        
        // Extract scenario tags
        for (const line of scenarioLines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('@')) {
                metadata.tags.push(...trimmed.split(' ').filter(tag => tag.startsWith('@')));
            }
        }
        
        // Assess complexity based on step count and content
        const stepCount = scenarioLines.filter(line => {
            const trimmed = line.trim();
            return ['Given', 'When', 'Then', 'And', 'But'].some(keyword => trimmed.startsWith(keyword + ' '));
        }).length;
        
        if (stepCount <= 3) metadata.complexity = 'low';
        else if (stepCount <= 7) metadata.complexity = 'medium';
        else metadata.complexity = 'high';
        
        return metadata;
    }

    async buildExecutionFlow(scenarioInfo, platform, includeAssertions, includeErrorHandling, detailLevel) {
        const executionFlow = {
            preConditions: [],
            mainFlow: [],
            postConditions: [],
            errorHandling: [],
            assertions: []
        };

        // Build pre-conditions
        executionFlow.preConditions = await this.buildPreConditions(scenarioInfo);
        
        // Build main execution flow
        executionFlow.mainFlow = await this.buildMainFlow(scenarioInfo, platform, detailLevel);
        
        // Add assertions if requested
        if (includeAssertions) {
            executionFlow.assertions = await this.buildAssertions(scenarioInfo, platform);
        }
        
        // Add error handling if requested
        if (includeErrorHandling) {
            executionFlow.errorHandling = await this.buildErrorHandling(scenarioInfo, platform);
        }
        
        // Build post-conditions
        executionFlow.postConditions = await this.buildPostConditions(scenarioInfo);
        
        return executionFlow;
    }

    async buildPreConditions(scenarioInfo) {
        const preConditions = [];
        
        // Check for login requirements
        if (scenarioInfo.steps.some(step => step.text.includes('logged in'))) {
            preConditions.push({
                type: 'authentication',
                description: 'User authentication required',
                implementation: 'Login API setup and user credential verification'
            });
        }
        
        // Check for specific account requirements
        const accountMatch = scenarioInfo.scenarioContent.match(/account["']\s*([^"']+)["']/);
        if (accountMatch) {
            preConditions.push({
                type: 'test_data',
                description: `Specific account required: ${accountMatch[1]}`,
                implementation: 'Account setup and verification'
            });
        }
        
        // Check for page navigation requirements
        if (scenarioInfo.steps.some(step => step.text.includes('go to') || step.text.includes('navigate'))) {
            preConditions.push({
                type: 'navigation',
                description: 'Initial page navigation required',
                implementation: 'Navigate to starting page/screen'
            });
        }
        
        return preConditions;
    }

    async buildMainFlow(scenarioInfo, platform, detailLevel) {
        const mainFlow = [];
        
        for (let i = 0; i < scenarioInfo.steps.length; i++) {
            const step = scenarioInfo.steps[i];
            const flowStep = await this.convertStepToFlowStep(step, platform, detailLevel, i + 1);
            mainFlow.push(flowStep);
        }
        
        return mainFlow;
    }

    async convertStepToFlowStep(step, platform, detailLevel, stepNumber) {
        const flowStep = {
            stepNumber,
            keyword: step.keyword,
            description: step.text,
            actionType: this.determineActionType(step.text),
            implementation: {},
            estimatedDuration: this.estimateStepDuration(step.text)
        };
        
        // Add platform-specific implementation details
        if (platform === 'Android' || platform === 'both') {
            flowStep.implementation.android = await this.getAndroidImplementation(step);
        }
        
        if (platform === 'iOS' || platform === 'both') {
            flowStep.implementation.ios = await this.getIOSImplementation(step);
        }
        
        // Add detailed implementation if requested
        if (detailLevel === 'detailed' || detailLevel === 'comprehensive') {
            flowStep.technicalDetails = await this.getTechnicalDetails(step);
        }
        
        if (detailLevel === 'comprehensive') {
            flowStep.pageObjectMethods = await this.getRelatedPageObjectMethods(step);
            flowStep.stepDefinitionCode = await this.getStepDefinitionCode(step);
        }
        
        return flowStep;
    }

    determineActionType(stepText) {
        const text = stepText.toLowerCase();
        
        if (text.includes('tap') || text.includes('click')) return 'tap';
        if (text.includes('input') || text.includes('type') || text.includes('enter')) return 'input';
        if (text.includes('scroll')) return 'scroll';
        if (text.includes('swipe')) return 'swipe';
        if (text.includes('see') || text.includes('verify') || text.includes('check')) return 'verification';
        if (text.includes('wait')) return 'wait';
        if (text.includes('navigate') || text.includes('go to')) return 'navigation';
        if (text.includes('logged in')) return 'authentication';
        if (text.includes('skip')) return 'conditional_action';
        
        return 'unknown';
    }

    async getAndroidImplementation(step) {
        // This would contain Android-specific element selectors and actions
        return {
            selectors: await this.extractSelectors(step.text, 'android'),
            action: this.getAndroidAction(step.text),
            waitStrategy: this.getWaitStrategy(step.text)
        };
    }

    async getIOSImplementation(step) {
        // This would contain iOS-specific element selectors and actions
        return {
            selectors: await this.extractSelectors(step.text, 'ios'),
            action: this.getIOSAction(step.text),
            waitStrategy: this.getWaitStrategy(step.text)
        };
    }

    async buildAssertions(scenarioInfo, platform) {
        const assertions = [];
        
        // Build assertions based on scenario steps and example data
        for (const step of scenarioInfo.steps) {
            if (step.keyword === 'Then' || step.text.includes('see') || step.text.includes('verify')) {
                assertions.push({
                    type: 'element_verification',
                    description: step.text,
                    implementation: await this.getAssertionImplementation(step, platform),
                    timeout: 10000
                });
            }
        }
        
        // Add example data assertions
        if (scenarioInfo.exampleData) {
            for (const [key, value] of Object.entries(scenarioInfo.exampleData)) {
                if (key.includes('Selector')) {
                    assertions.push({
                        type: 'element_presence',
                        description: `Verify element ${value} is present`,
                        selector: value,
                        timeout: 15000
                    });
                }
            }
        }
        
        return assertions;
    }

    async buildErrorHandling(scenarioInfo, platform) {
        return [
            {
                type: 'element_not_found',
                description: 'Handle missing elements with retry logic',
                strategy: 'retry_with_scroll'
            },
            {
                type: 'network_timeout',
                description: 'Handle network timeouts',
                strategy: 'retry_with_delay'
            },
            {
                type: 'unexpected_popup',
                description: 'Handle unexpected popups or dialogs',
                strategy: 'dismiss_and_continue'
            }
        ];
    }

    async buildPostConditions(scenarioInfo) {
        return [
            {
                type: 'cleanup',
                description: 'Clean up test data and reset app state',
                implementation: 'Reset app to initial state'
            },
            {
                type: 'verification',
                description: 'Verify test completion status',
                implementation: 'Capture final state and verify success criteria'
            }
        ];
    }

    calculateEstimatedDuration(executionFlow) {
        let totalDuration = 0;
        
        totalDuration += executionFlow.preConditions.length * 5000; // 5s per precondition
        totalDuration += executionFlow.mainFlow.reduce((sum, step) => sum + (step.estimatedDuration || 3000), 0);
        totalDuration += executionFlow.assertions.length * 2000; // 2s per assertion
        totalDuration += executionFlow.postConditions.length * 3000; // 3s per postcondition
        
        return totalDuration;
    }

    assessComplexity(executionFlow) {
        const stepCount = executionFlow.mainFlow.length;
        const assertionCount = executionFlow.assertions.length;
        const complexActions = executionFlow.mainFlow.filter(step => 
            ['scroll', 'swipe', 'conditional_action'].includes(step.actionType)
        ).length;
        
        const score = stepCount * 1 + assertionCount * 0.5 + complexActions * 2;
        
        if (score <= 5) return 'low';
        if (score <= 15) return 'medium';
        return 'high';
    }

    estimateStepDuration(stepText) {
        const text = stepText.toLowerCase();
        
        if (text.includes('wait')) return 5000;
        if (text.includes('scroll') || text.includes('swipe')) return 4000;
        if (text.includes('input') || text.includes('type')) return 3000;
        if (text.includes('navigate') || text.includes('logged in')) return 8000;
        if (text.includes('tap') || text.includes('click')) return 2000;
        if (text.includes('see') || text.includes('verify')) return 3000;
        
        return 3000; // default
    }

    // Additional helper methods would be implemented here...
    async extractSelectors(stepText, platform) {
        // Extract selectors based on step text and platform
        return {
            primary: 'element_selector',
            fallback: 'fallback_selector'
        };
    }

    getAndroidAction(stepText) {
        // Return Android-specific action
        return 'click';
    }

    getIOSAction(stepText) {
        // Return iOS-specific action  
        return 'tap';
    }

    getWaitStrategy(stepText) {
        return 'waitForDisplayed';
    }

    async getAssertionImplementation(step, platform) {
        return {
            method: 'isDisplayed',
            expectedResult: true,
            timeout: 10000
        };
    }

    async analyzeDependencies(scenarioInfo, includeAPICallsFlow, includeDataRequirements) {
        const dependencies = {
            apiDependencies: [],
            dataDependencies: [],
            componentDependencies: []
        };

        // Analyze API dependencies based on scenario content
        if (includeAPICallsFlow) {
            if (scenarioInfo.steps.some(step => step.text.includes('logged in'))) {
                dependencies.apiDependencies.push({
                    service: 'Authentication API',
                    endpoint: '/auth/login',
                    purpose: 'User authentication and session management',
                    required: true
                });
            }

            if (scenarioInfo.scenarioContent.includes('Dana Goals') || scenarioInfo.exampleData.feature === 'Dana Goals') {
                dependencies.apiDependencies.push({
                    service: 'Investment Service API',
                    endpoint: '/investment/dana-goals',
                    purpose: 'Dana Goals feature availability and data',
                    required: true
                });
            }

            if (scenarioInfo.steps.some(step => step.text.includes('Me page'))) {
                dependencies.apiDependencies.push({
                    service: 'User Profile API',
                    endpoint: '/user/profile',
                    purpose: 'Me page data loading and user information',
                    required: true
                });
            }
        }

        // Analyze data dependencies
        if (includeDataRequirements) {
            // Check for specific account requirements
            const accountMatch = scenarioInfo.scenarioContent.match(/account.*?["']([^"']+)["']/);
            if (accountMatch) {
                dependencies.dataDependencies.push({
                    type: 'test_account',
                    name: accountMatch[1],
                    requirements: 'Active account with required feature access',
                    source: 'Account management system'
                });
            }

            // Check for feature-specific data
            if (scenarioInfo.exampleData) {
                Object.entries(scenarioInfo.exampleData).forEach(([key, value]) => {
                    if (key === 'feature' && value) {
                        dependencies.dataDependencies.push({
                            type: 'feature_flag',
                            name: `${value.toLowerCase().replace(' ', '_')}_enabled`,
                            requirements: `${value} feature must be enabled for test account`,
                            source: 'Feature flag service'
                        });
                    }
                });
            }
        }

        // Analyze component dependencies
        const stepDefinitionTag = scenarioInfo.scenarioContent.match(/#(\w+)/);
        if (stepDefinitionTag) {
            const tag = stepDefinitionTag[1];
            dependencies.componentDependencies.push({
                type: 'page_object',
                name: `${tag}.page.js`,
                methods: this.extractPageObjectMethods(scenarioInfo.steps),
                purpose: 'Page interaction implementations'
            });

            dependencies.componentDependencies.push({
                type: 'step_definition',
                name: `${tag}.steps.js`,
                patterns: this.extractStepPatterns(scenarioInfo.steps),
                purpose: 'Cucumber step implementations'
            });
        }

        return dependencies;
    }

    async performScenarioSearch(searchCriteria, limit) {
        const results = [];
        const { featureName, tags, stepContains, exampleData } = searchCriteria;

        try {
            let searchCommand = `find "${this.featuresPath}" -name "*.feature"`;
            
            if (featureName) {
                searchCommand += ` -exec grep -l "Feature:.*${featureName}" {} \\;`;
            }

            const { execSync } = await import('child_process');
            const featureFiles = execSync(searchCommand, { encoding: 'utf-8' }).trim().split('\n').filter(f => f);

            for (const filePath of featureFiles.slice(0, limit)) {
                try {
                    const content = await fs.readFile(filePath, 'utf-8');
                    const lines = content.split('\n');
                    
                    // Find scenarios matching criteria
                    let currentScenario = null;
                    let scenarioLines = [];
                    let foundTag = false;

                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i].trim();
                        
                        // Check for scenario start
                        if (line.startsWith('Scenario') || line.startsWith('@')) {
                            if (currentScenario && foundTag) {
                                results.push({
                                    filePath,
                                    scenario: currentScenario,
                                    content: scenarioLines.join('\n')
                                });
                            }
                            
                            if (line.startsWith('Scenario')) {
                                currentScenario = line;
                                scenarioLines = [line];
                                foundTag = false;
                            } else if (line.startsWith('@')) {
                                scenarioLines.push(line);
                                // Check if this tag matches search criteria
                                if (tags && tags.some(tag => line.includes(tag))) {
                                    foundTag = true;
                                }
                            }
                        } else if (currentScenario) {
                            scenarioLines.push(line);
                            
                            // Check step content
                            if (stepContains && line.includes(stepContains)) {
                                foundTag = true;
                            }
                            
                            // Check example data
                            if (exampleData && line.includes(exampleData)) {
                                foundTag = true;
                            }
                        }
                    }
                    
                    // Check last scenario
                    if (currentScenario && foundTag) {
                        results.push({
                            filePath,
                            scenario: currentScenario,
                            content: scenarioLines.join('\n')
                        });
                    }
                } catch (error) {
                    console.warn(`Error processing file ${filePath}:`, error.message);
                }
            }
        } catch (error) {
            console.error('Error in scenario search:', error.message);
        }

        return results.slice(0, limit);
    }

    async buildTestPlan(scenarios, executionStrategy, includeSetupTeardown) {
        // Implementation for test plan generation
        return {
            scenarios,
            strategy: executionStrategy,
            estimatedDuration: 0,
            setup: [],
            teardown: []
        };
    }

    async identifyAutomationGaps(scenarioInfo, checkPageObjects, checkStepDefinitions) {
        // Implementation for gap analysis
        return {
            missingPageObjects: [],
            missingStepDefinitions: [],
            incompleteImplementations: []
        };
    }

    generateRecommendations(gaps) {
        // Generate recommendations based on gaps
        return [];
    }

    async getRelatedScenarios(filePath) {
        // Get other scenarios from the same feature file
        return [];
    }

    async getPageObjectsForScenario(scenarioInfo) {
        // Get related page objects
        return [];
    }

    async getStepDefinitionsForScenario(scenarioInfo) {
        // Get related step definitions
        return [];
    }

    async getTechnicalDetails(step) {
        // Get technical implementation details
        return {};
    }

    async getRelatedPageObjectMethods(step) {
        // Get related page object methods
        return [];
    }

    async getStepDefinitionCode(step) {
        // Get step definition code
        return `When(/^${step.text.replace(/'/g, "\\'")}$/, async () => {
    // Implementation for: ${step.text}
    // TODO: Add actual implementation
});`;
    }

    extractPageObjectMethods(steps) {
        const methods = [];
        steps.forEach(step => {
            const text = step.text.toLowerCase();
            if (text.includes('tap') || text.includes('click')) {
                methods.push(`tap${step.text.match(/['"]([^'"]+)['"]/)?.[1]?.replace(/\s+/g, '') || 'Element'}()`);
            }
            if (text.includes('see') || text.includes('verify')) {
                methods.push(`verify${step.text.match(/['"]([^'"]+)['"]/)?.[1]?.replace(/\s+/g, '') || 'Element'}IsDisplayed()`);
            }
            if (text.includes('input') || text.includes('type')) {
                methods.push(`input${step.text.match(/['"]([^'"]+)['"]/)?.[1]?.replace(/\s+/g, '') || 'Text'}()`);
            }
        });
        return [...new Set(methods)]; // Remove duplicates
    }

    extractStepPatterns(steps) {
        return steps.map(step => {
            const pattern = step.text
                .replace(/'/g, "\\'")
                .replace(/\b\w+\b/g, match => {
                    if (['Given', 'When', 'Then', 'And', 'But'].includes(match)) return match;
                    return match;
                });
            return `${step.keyword} /^${pattern}$/`;
        });
    }
}

// Start the server
const server = new AgentMobilePlannerServer();
server.start().catch(console.error);
