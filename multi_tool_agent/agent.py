# Multi-Agent System Implementation for Comprehensive Automation
import os
from google.adk.agents import LlmAgent, SequentialAgent, ParallelAgent
from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset, StdioServerParameters

# Path configurations
TARGET_FOLDER_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "mcp-servers")
NODE_PATH = "/Users/sariputray/.nvm/versions/node/v18.20.8/bin/node"

# Specialized Agent Definitions
# ==============================

# 1. Web Automation Specialist
web_automation_agent = LlmAgent(
    model='gemini-2.5-flash-preview-05-20',
    name='web_automation_specialist',
    description='Specialist for web browser automation, testing, and interaction using Playwright',
    instruction='''You are a web automation specialist. You excel at:
    - Browser automation and testing
    - Web scraping and data extraction
    - UI testing and validation
    - Taking screenshots and generating reports
    - Handling dynamic web content and SPAs
    
    Use Playwright tools for all web-related tasks.''',
    tools=[
        MCPToolset(
            connection_params=StdioServerParameters(
                command='npx',
                args=['-y', '@playwright/mcp@latest']
            ),
        ),
    ],
)

# 2. Mobile Automation Specialist
mobile_automation_agent = LlmAgent(
    model='gemini-2.5-flash-preview-05-20',
    name='mobile_automation_specialist', 
    description='Specialist for mobile device automation and testing using Appium',
    instruction='''You are a mobile automation specialist. You excel at:
    - Android and iOS device automation
    - Mobile app testing and interaction
    - Device connectivity and management
    - Mobile UI element discovery and interaction
    - Screenshot capture and analysis
    
    Use Appium tools for all mobile-related tasks.''',
    tools=[
        MCPToolset(
            connection_params=StdioServerParameters(
                command=NODE_PATH,
                args=[os.path.join(TARGET_FOLDER_PATH, 'mcp-appium-server-new.js')]
            ),
        ),
    ],
)

# 3. Code Management Specialist
code_management_agent = LlmAgent(
    model='gemini-2.5-flash-preview-05-20',
    name='code_management_specialist',
    description='Specialist for code analysis, modification, and development tasks',
    instruction='''You are a code management specialist. You excel at:
    - Code analysis and quality assessment
    - File and code modification
    - Refactoring and optimization
    - Code generation and templates
    - Programming best practices
    
    Use code analysis and modification tools for all development tasks.''',
    tools=[
        MCPToolset(
            connection_params=StdioServerParameters(
                command=NODE_PATH,
                args=[os.path.join(TARGET_FOLDER_PATH, 'mcp-code-analysis-server.js')]
            ),
        ),
        MCPToolset(
            connection_params=StdioServerParameters(
                command=NODE_PATH,
                args=[os.path.join(TARGET_FOLDER_PATH, 'mcp-code-modification-server.js')]
            ),
        ),
    ],
)

# 4. File Operations Specialist
file_operations_agent = LlmAgent(
    model='gemini-2.5-flash-preview-05-20',
    name='file_operations_specialist',
    description='Specialist for file system operations, data processing, and file management',
    instruction='''You are a file operations specialist. You excel at:
    - File system navigation and management
    - Data processing and transformation
    - File creation, modification, and organization
    - Backup and archival operations
    - Log analysis and processing
    
    Use filesystem tools for all file-related tasks.''',
    tools=[
        MCPToolset(
            connection_params=StdioServerParameters(
                command=NODE_PATH,
                args=[os.path.join(TARGET_FOLDER_PATH, 'mcp-filesystem-server.js')]
            ),
        ),
    ],
)

# 5. Test Execution Specialist
test_execution_agent = LlmAgent(
    model='gemini-2.5-flash-preview-05-20',
    name='test_execution_specialist',
    description='Specialist for test execution, terminal operations, and system automation',
    instruction='''You are a test execution specialist. You excel at:
    - Running automated tests and test suites
    - Terminal and command-line operations
    - CI/CD pipeline integration
    - System monitoring and validation
    - Test reporting and analysis
    
    Use test execution and terminal tools for all testing tasks.''',
    tools=[
        MCPToolset(
            connection_params=StdioServerParameters(
                command=NODE_PATH,
                args=[os.path.join(TARGET_FOLDER_PATH, 'mcp-test-execution-server.js')]
            ),
        ),
    ],
)

# 6. Advanced Tools Specialist
advanced_tools_agent = LlmAgent(
    model='gemini-2.5-flash-preview-05-20',
    name='advanced_tools_specialist',
    description='Specialist for advanced automation tasks and custom utilities',
    instruction='''You are an advanced tools specialist. You excel at:
    - Complex automation workflows
    - Custom utility functions
    - Advanced data processing
    - Integration between different systems
    - Specialized automation tasks
    
    Use advanced tools for complex or specialized tasks.''',
    tools=[
        MCPToolset(
            connection_params=StdioServerParameters(
                command=NODE_PATH,
                args=[os.path.join(TARGET_FOLDER_PATH, 'mcp-advanced-server.js')]
            ),
        ),
    ],
)

# Main Coordinator Agent
# ======================
coordinator_agent = LlmAgent(
    model='gemini-2.5-flash-preview-05-20',
    name='automation_coordinator',
    description='Main coordinator for comprehensive automation tasks',
    instruction='''You are the automation coordinator. Your job is to analyze user requests and delegate tasks to the appropriate specialist agents.

Available specialists:
- web_automation_specialist: For browser, web testing, and web scraping tasks
- mobile_automation_specialist: For mobile device automation and app testing  
- code_management_specialist: For code analysis, modification, and development
- file_operations_specialist: For file system operations and data processing
- test_execution_specialist: For running tests and terminal operations
- advanced_tools_specialist: For complex or specialized automation tasks

When you receive a request:
1. Analyze what type of automation is needed
2. Determine which specialist(s) would be best suited
3. Transfer to the appropriate specialist using transfer_to_agent()
4. If multiple specialists are needed, coordinate between them

Examples:
- "Test a web application" → transfer to web_automation_specialist  
- "Connect to Android device" → transfer to mobile_automation_specialist
- "Analyze code quality" → transfer to code_management_specialist
- "Process log files" → transfer to file_operations_specialist
- "Run test suite" → transfer to test_execution_specialist
- "Complex workflow automation" → transfer to advanced_tools_specialist

Always explain why you're transferring to a specific specialist.''',
    
    # Define the hierarchy - coordinator has all specialists as sub-agents
    sub_agents=[
        web_automation_agent,
        mobile_automation_agent, 
        code_management_agent,
        file_operations_agent,
        test_execution_agent,
        advanced_tools_agent,
    ],
)

# Alternative: Sequential Pipeline for Complex Workflows
# ====================================================
def create_testing_pipeline():
    """Create a sequential pipeline for comprehensive testing workflows"""
    return SequentialAgent(
        name='comprehensive_testing_pipeline',
        sub_agents=[
            file_operations_agent,  # Setup test environment
            code_management_agent,  # Analyze/prepare code
            test_execution_agent,   # Run tests
            web_automation_agent,   # Web-based testing
            mobile_automation_agent, # Mobile testing
            advanced_tools_agent,   # Generate reports
        ],
    )

# Alternative: Parallel Information Gathering
# ==========================================
def create_parallel_analysis():
    """Create parallel analysis for multi-domain assessment"""
    return ParallelAgent(
        name='parallel_analysis_system',
        sub_agents=[
            code_management_agent,   # Analyze code quality
            file_operations_agent,   # Analyze file structure
            test_execution_agent,    # Run system checks
        ],
    )

# Main Multi-Agent System
# =======================
# Default: Use coordinator pattern
root_agent = coordinator_agent

# Alternative configurations (uncomment to use):
# root_agent = create_testing_pipeline()  # For sequential testing workflows
# root_agent = create_parallel_analysis()  # For parallel analysis tasks
