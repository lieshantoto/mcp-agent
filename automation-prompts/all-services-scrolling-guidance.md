# All Services Page Scrolling Guidance for Test Automation

## Overview
This guide provides specific instructions for handling All Services page scenarios where services may not be immediately visible and require scrolling to locate.

## Problem Statement
When executing test cases like @NTC-44101 (eMas DANA service), the agent may get confused on the All Services page because:
1. Services are not immediately visible on screen
2. Services are arranged in a scrollable grid layout
3. The service icon selector (e.g., `~icn-service-emas`) may not be found without scrolling
4. The agent needs guidance on systematic search strategies

## Enhanced Scrolling Strategy for All Services Page

### Phase 1: Initial Element Detection
When on the All Services page and searching for a service:

1. **First Attempt**: Try to find the target service directly
   ```
   - Use the provided selector (e.g., `~icn-service-emas`)
   - Wait up to 5 seconds for element to appear
   - If found: proceed with test
   - If not found: proceed to scrolling strategy
   ```

2. **Capture Current State**: 
   ```
   - Take screenshot to document current visible services
   - Get page source to analyze current UI structure
   - Document which services are currently visible
   ```

### Phase 2: Systematic Scrolling Search

When the target service is not immediately visible:

1. **Scroll Down Strategy**:
   ```
   - Perform scroll down gesture (start: center of screen, end: 1/3 up from bottom)
   - Wait 2 seconds for content to settle
   - Search for target service again
   - Take screenshot after each scroll for documentation
   - Repeat up to 5 times maximum
   ```

2. **Scroll Parameters**:
   ```javascript
   // Example scroll coordinates for All Services page
   startX: 540, startY: 1200  // Center horizontal, middle vertical
   endX: 540, endY: 400       // Same horizontal, scroll up
   duration: 1000             // 1 second scroll duration
   ```

3. **Progress Tracking**:
   ```
   - Count scroll attempts
   - Note new services that become visible
   - Stop if same content appears twice (reached end)
   - Document scroll progress in logs
   ```

### Phase 3: Alternative Search Strategies

If scrolling doesn't locate the service:

1. **Search by Text**:
   ```
   - Look for service name text (e.g., "eMas DANA", "DANA Goals")
   - Use partial text matching
   - Search for related keywords
   ```

2. **Search by Content Description**:
   ```
   - Try variations of the selector:
     - `~icn-service-emas`
     - Content description containing "emas"
     - Accessibility ID variations
   ```

3. **Visual Search**:
   ```
   - Analyze screenshots for service icons
   - Look for visual patterns or logos
   - Use coordinate-based tapping if icon is visible but not selectable
   ```

### Phase 4: Error Handling

If service still cannot be found:

1. **Comprehensive Documentation**:
   ```
   - Capture final screenshot
   - Get complete page source
   - List all visible services discovered during scrolling
   - Document scroll attempts and results
   ```

2. **Alternative Approaches**:
   ```
   - Try searching from top of page again
   - Use different scroll directions (up, then down)
   - Check if service is in a different section or category
   ```

3. **Fallback Strategy**:
   ```
   - Report that service may not be available
   - Suggest checking app version or environment
   - Provide detailed findings for manual verification
   ```

## MCP Tool Implementation

### Recommended Tool Sequence:

1. **Initial Search**:
   ```
   f1e_find_element(strategy="contentDescription", selector="icn-service-emas", timeout=5000)
   ```

2. **Screenshot for Documentation**:
   ```
   f1e_get_screenshot(filename="before_scroll_search")
   ```

3. **Scrolling Loop**:
   ```
   for (i = 0; i < 5; i++) {
     f1e_swipe(startX=540, startY=1200, endX=540, endY=400, duration=1000)
     f1e_wait_for_element(selector="visible_content", timeout=2000)
     f1e_find_element(strategy="contentDescription", selector="icn-service-emas")
     f1e_get_screenshot(filename=`scroll_attempt_${i+1}`)
   }
   ```

4. **Alternative Search**:
   ```
   f1e_find_element(strategy="text", selector="eMas DANA", timeout=5000)
   f1e_find_elements(strategy="contentDescription", selector="*emas*")
   ```

## Agent Instructions

### When Executing All Services Tests:

1. **Always assume scrolling may be needed**
2. **Document each step with screenshots**
3. **Be systematic in search approach**
4. **Don't give up after first failed attempt**
5. **Provide detailed reporting of findings**

### Specific Prompts to Add to Agent:

```markdown
## All Services Page Element Search Protocol

When searching for a service on the All Services page:

1. **FIRST**: Try direct element lookup with 5-second timeout
2. **IF NOT FOUND**: Begin systematic scrolling search:
   - Take screenshot of current state
   - Scroll down in increments
   - Search after each scroll
   - Document progress
   - Maximum 5 scroll attempts
3. **IF STILL NOT FOUND**: Try alternative selectors:
   - Text-based search
   - Partial content description matching
   - Visual coordinate identification
4. **ALWAYS**: Provide comprehensive documentation of search process

### Sample Agent Dialog:
"The service 'eMas DANA' was not immediately visible. I'll now scroll down systematically to search for it. Taking screenshot of current state and beginning scroll search..."

[After each scroll]
"Scroll attempt 1/5 completed. New services visible: [list services]. Searching for 'eMas DANA'..."

[If found]
"Service 'eMas DANA' located after scroll attempt 3. Proceeding with test..."

[If not found after all attempts]
"After 5 scroll attempts, 'eMas DANA' service was not located. Visible services discovered: [complete list]. Trying alternative search strategies..."
```

## Integration with Existing Test Cases

### For @NTC-44101 and Similar Tests:

1. **Update step implementation** to include scrolling logic
2. **Add waiting periods** between scroll and search
3. **Include progress reporting** in test execution
4. **Document all discovered services** for future reference

### Example Enhanced Step:

```gherkin
When I tap "~icn-service-emas" Icon Selector on All Services Page
```

**Enhanced Implementation**:
```javascript
// Step: Tap service icon with scrolling support
async tapServiceIconOnAllServicesPage(iconSelector) {
  console.log(`Searching for service with selector: ${iconSelector}`);
  
  // Phase 1: Direct search
  let element = await this.findElementWithTimeout(iconSelector, 5000);
  if (element) {
    await element.click();
    return;
  }
  
  console.log(`Service not immediately visible. Beginning scroll search...`);
  await this.takeScreenshot('before_scroll_search');
  
  // Phase 2: Scroll search
  for (let i = 0; i < 5; i++) {
    console.log(`Scroll attempt ${i + 1}/5`);
    await this.scrollDown();
    await this.wait(2000); // Wait for content to settle
    
    element = await this.findElementWithTimeout(iconSelector, 3000);
    if (element) {
      console.log(`Service found after ${i + 1} scroll attempts`);
      await this.takeScreenshot(`service_found_after_scroll_${i + 1}`);
      await element.click();
      return;
    }
    
    await this.takeScreenshot(`scroll_attempt_${i + 1}`);
  }
  
  // Phase 3: Alternative search
  console.log(`Direct scrolling failed. Trying alternative search methods...`);
  // Try text-based search, etc.
  
  throw new Error(`Service with selector ${iconSelector} not found after comprehensive search`);
}
```

## Success Metrics

A successful implementation should:
1. **Reduce false negatives** from services not being immediately visible
2. **Provide clear documentation** of search process
3. **Handle edge cases** gracefully
4. **Maintain test reliability** across different device sizes and screen resolutions
5. **Give actionable feedback** when services are not found

## Notes for Agent Training

- **Always be patient** - scrolling and searching takes time
- **Document thoroughly** - screenshots and logs are crucial for debugging
- **Be systematic** - follow the phases in order
- **Communicate clearly** - explain what you're doing and why
- **Don't assume** - verify each step with screenshots
- **Be persistent** - try multiple approaches before giving up