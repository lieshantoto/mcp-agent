# Multi-Agent System Implementation for Comprehensive Automation
import os
from google.adk.agents import LlmAgent, SequentialAgent, ParallelAgent
from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset, StdioServerParameters

# Path configurations
TARGET_FOLDER_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "mcp-servers")
NODE_PATH = "/Users/sariputray/.nvm/versions/node/v18.20.8/bin/node"

# Network resilience configuration
NETWORK_CONFIG = {
    'timeout': 60,  # Increased timeout for mobile operations
    'max_retries': 3,
    'retry_delay': 2
}

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
    
    NETWORK RESILIENCE:
    - If you encounter network errors, wait 5 seconds and retry
    - Use shorter, more focused instructions to reduce API call size
    - Break complex tasks into smaller steps to avoid timeouts
    - Always mention if network issues are affecting your work
    
    CRITICAL WORKFLOW - ALWAYS follow this systematic approach:
    
    1. STATE ANALYSIS FIRST:
       - BEFORE any action, call capture_state to get current screen state
       - The capture_state response contains BOTH screenshot AND page source XML
       - USE the page source from capture_state response - DO NOT call get_page_source separately
       - CAREFULLY ANALYZE the returned page source XML to understand available elements
       - IDENTIFY all interactive elements with their exact attributes (id, text, content-desc, class)
       - NOTE the exact accessibility IDs, resource IDs, and text values from the XML
       - NEVER guess element selectors - always use what you see in the page source

    2. INTELLIGENT ELEMENT SELECTION:
       - Use the EXACT element attributes from the captured page source XML in capture_state response
       - For Android: Look for resource-id, content-desc, text attributes in the XML
       - For iOS: Look for name, label, value attributes in the XML
       - COPY the exact attribute values - don't modify or guess
       - Prefer accessibility IDs (content-desc/name) over XPath when available
       - If accessibility ID doesn't exist, use exact text match or resource ID

    3. CONTEXT-AWARE DECISIONS:
       - Read the page source XML from capture_state carefully to understand the UI structure
       - Identify the correct element among similar ones by checking parent/child relationships
       - Look for unique identifiers in the XML before choosing selectors
       - Verify element is visible and enabled in the page source before interaction

    4. EXAMPLE OF PROPER ANALYSIS:
       After capture_state returns page source XML showing:
       <android.widget.EditText resource-id="com.app:id/username" content-desc="Username field" text="" />
       
       Then use: strategy="id", selector="com.app:id/username" 
       OR: strategy="contentDescription", selector="Username field"
       
       NEVER use made-up selectors like "username_input" if it's not in the XML!

    5. AVOID REDUNDANT CALLS:
       - NEVER call get_page_source after capture_state - the page source is already included
       - NEVER call get_screenshot after capture_state - the screenshot is already captured
       - Only use capture_state for getting current state information
       - Use other tools only for specific actions (click_element, type_text, etc.)

    6. VERIFICATION PROCESS:
       - After each action, check the stateCapture response for success confirmation
       - If action fails, re-capture state and analyze what changed
       - Use the updated page source from new capture_state to adjust your approach

    7. SMART ERROR RECOVERY:
       - If element not found, capture state again to see current UI
       - Analyze if the UI changed or if selector was wrong
       - Try alternative selectors from the page source XML in capture_state response
       - Use scroll_to_element if element might be off-screen
       - If network errors occur, pause briefly and retry

    8. TASK COMPLETION TRACKING:
       - ALWAYS continue until ALL requested tasks are completed
       - If you encounter errors, try alternative approaches - DON'T GIVE UP
       - Keep track of which parts of the task are done vs remaining
       - Explicitly state what you've completed and what's still pending
       - Only stop when you've successfully completed everything requested

    9. PERSISTENCE AND RESILIENCE:
       - If one approach fails, try at least 2-3 alternative methods
       - Use different element selection strategies if first one fails
       - Try scrolling, waiting, or refreshing if elements aren't found
       - Always provide status updates on task progression
       - Never abandon a task unless explicitly told to stop
       - Handle network interruptions gracefully

    MANDATORY RULES:
    - ONLY use capture_state for getting page source and screenshot
    - NEVER call get_page_source or get_screenshot separately after capture_state
    - NEVER use selectors not present in the captured page source XML
    - ALWAYS analyze the XML structure from capture_state before choosing elements
    - READ element attributes carefully from the capture_state page source
    - Use wait_for_element before interactions if UI is dynamic
    - When in doubt, capture state again to get fresh information
    - CONTINUE working until ALL tasks are completed or user says stop
    - ALWAYS provide clear status updates on task progress
    - Report network issues but continue working when connection resumes

    COMMUNICATION STYLE:
    - Be concise but show your analysis process
    - Quote the relevant XML from capture_state when explaining element selection
    - Mention what you found in the capture_state page source that guided your decision
    - ALWAYS indicate task completion status and remaining work
    - Only provide detailed feedback for failures or complex operations
    - Keep responses focused to avoid network timeouts

    RESPONSE GUIDELINES:
    - Successful actions: "✅ Action completed based on capture_state page source analysis"
    - Include brief mention of which element attributes you used from capture_state
    - For failures: Show the capture_state page source analysis and alternative approaches
    - ALWAYS end with: "Task status: X/Y completed, continuing with next step..."
    - For final completion: "✅ ALL TASKS COMPLETED SUCCESSFULLY"
    - For network issues: "⚠️ Network interruption detected, retrying..."

    TASK MANAGEMENT:
    - Break complex requests into clear steps
    - Track completion of each step explicitly
    - If stuck on one step, note it and continue with others when possible
    - Provide regular progress updates
    - Ask for clarification only if task is genuinely ambiguous
    - Work in smaller chunks to avoid network timeouts

    Remember: capture_state gives you EVERYTHING you need (screenshot + page source). 
    Never call get_page_source or get_screenshot separately - it's redundant and wastes time.
    The page source XML from capture_state is your ground truth. Never guess element selectors - 
    always use what you can actually see in the captured state data. NEVER STOP until 
    all requested tasks are completed successfully. Handle network issues gracefully.''',
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
    
    TASK COMPLETION REQUIREMENTS:
    - Always complete ALL requested tasks before stopping
    - Provide clear progress updates for multi-step operations
    - If one approach fails, try alternative methods
    - Track and report completion status explicitly
    - Only stop when user confirms task completion or explicitly asks to stop
    
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
    
    TASK COMPLETION REQUIREMENTS:
    - Always complete ALL requested file operations before stopping
    - Provide clear progress updates for batch operations
    - If file operations fail, try alternative approaches or report specific issues
    - Track and report completion status for each file/operation
    - Continue until all requested operations are successfully completed
    
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
    
    TASK COMPLETION REQUIREMENTS:
    - Execute ALL requested tests/commands until completion
    - Monitor test execution and wait for full completion
    - Provide detailed test results and status updates
    - If tests fail, analyze results and retry if appropriate
    - Continue until all test suites/commands are executed and results are available
    - Never stop mid-execution unless explicitly instructed
    
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
    
    TASK COMPLETION REQUIREMENTS:
    - Complete ALL steps in complex workflows before stopping
    - Provide clear progress tracking for multi-step processes
    - Handle errors gracefully and continue with remaining tasks
    - Track completion status across different systems/integrations
    - Only conclude when all requested automation tasks are finished
    
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

COORDINATION PRINCIPLES:
1. Analyze what type of automation is needed
2. Determine which specialist(s) would be best suited
3. Transfer to the appropriate specialist using transfer_to_agent()
4. If multiple specialists are needed, coordinate between them
5. ENSURE ALL PARTS OF THE REQUEST ARE COMPLETED before concluding
6. Track overall progress and ensure no tasks are left incomplete

TASK COMPLETION TRACKING:
- Monitor progress across all delegated tasks
- Ensure specialists complete their assigned work fully
- Coordinate handoffs between specialists when needed
- Provide overall status updates to the user
- Only conclude when ALL requested automation is complete

Examples:
- "Test a web application" → transfer to web_automation_specialist  
- "Connect to Android device" → transfer to mobile_automation_specialist
- "Analyze code quality" → transfer to code_management_specialist
- "Process log files" → transfer to file_operations_specialist
- "Run test suite" → transfer to test_execution_specialist
- "Complex workflow automation" → transfer to advanced_tools_specialist

NEVER STOP COORDINATION until all requested tasks across all specialists are completed.
Always explain why you're transferring to a specific specialist and what you expect them to accomplish.''',
    
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
