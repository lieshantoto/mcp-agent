# ./adk_agent_samples/mcp_agent/agent.py
import os # Required for path operations
from google.adk.agents import LlmAgent
from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset, StdioServerParameters

# It's good practice to define paths dynamically if possible,
# or ensure the user understands the need for an ABSOLUTE path.
# For this example, we'll construct a path relative to this file,
# assuming 'mcp-servers' is in the parent directory of agent.py.
TARGET_FOLDER_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "mcp-servers")
# Use the Node.js version from nvm to ensure compatibility
NODE_PATH = "/Users/sariputray/.nvm/versions/node/v18.20.8/bin/node"
# Ensure TARGET_FOLDER_PATH is an absolute path for the MCP server.
# If you created ./adk_agent_samples/mcp_agent/your_folder,

root_agent = LlmAgent(
    model='gemini-2.5-flash-preview-05-20',
    name='comprehensive_mcp_agent',
    instruction='A comprehensive automation agent with browser, filesystem, mobile testing, code analysis, and test execution capabilities',
    tools=[
        # Browser automation with Playwright
        MCPToolset(
            connection_params=StdioServerParameters(
                command='npx',
                args=[
                    '-y',
                    '@playwright/mcp@latest'
                ]
            ),
        ),
        
        # File system operations
        MCPToolset(
            connection_params=StdioServerParameters(
                command=NODE_PATH,
                args=[
                    os.path.join(TARGET_FOLDER_PATH, 'mcp-filesystem-server.js')
                ]
            ),
        ),
        
        # Mobile automation with Appium
        MCPToolset(
            connection_params=StdioServerParameters(
                command=NODE_PATH,
                args=[
                    os.path.join(TARGET_FOLDER_PATH, 'mcp-appium-server-new.js')
                ]
            ),
        ),
        
        # Test execution and terminal operations
        MCPToolset(
            connection_params=StdioServerParameters(
                command=NODE_PATH,
                args=[
                    os.path.join(TARGET_FOLDER_PATH, 'mcp-test-execution-server.js')
                ]
            ),
        ),
        
        # Code analysis and modification
        MCPToolset(
            connection_params=StdioServerParameters(
                command=NODE_PATH,
                args=[
                    os.path.join(TARGET_FOLDER_PATH, 'mcp-code-analysis-server.js')
                ]
            ),
        ),
        
        # Code modification tools
        MCPToolset(
            connection_params=StdioServerParameters(
                command=NODE_PATH,
                args=[
                    os.path.join(TARGET_FOLDER_PATH, 'mcp-code-modification-server.js')
                ]
            ),
        ),
        
        # Advanced MCP server
        MCPToolset(
            connection_params=StdioServerParameters(
                command=NODE_PATH,
                args=[
                    os.path.join(TARGET_FOLDER_PATH, 'mcp-advanced-server.js')
                ]
            ),
        ),
    ],
)