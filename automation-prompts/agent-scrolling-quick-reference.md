# Quick Agent Reference: All Services Page Scrolling Protocol

## When an agent encounters "Service not found" on All Services page:

### ✅ DO THIS IMMEDIATELY:
1. **Don't panic or give up** - services are often below the fold
2. **Take screenshot** of current state for documentation  
3. **Begin systematic scrolling** following this protocol:

### 📱 SCROLLING PROTOCOL:

```bash
# Step 1: Document current state
f1e_get_screenshot(filename="before_scroll_search")

# Step 2: Begin scroll loop (max 5 attempts)
for attempt in 1..5:
  # Scroll down
  f1e_swipe(startX=540, startY=1200, endX=540, endY=400, duration=1000)
  
  # Wait for content to settle
  f1e_wait_for_element(selector="visible_content", timeout=2000)
  
  # Search for target service
  found = f1e_find_element(strategy="contentDescription", selector="target_service")
  
  # Document attempt
  f1e_get_screenshot(filename=f"scroll_attempt_{attempt}")
  
  if found:
    break
```

### 🎯 TARGET SERVICES & SELECTORS:
- **eMas DANA**: `~icn-service-emas` → scroll to find
- **DANA Goals**: `~icn-service-goals` → scroll to find  
- **DANA Siaga**: `~icn-service-pasarpolis` → scroll to find
- **e-SBN**: `~icn-service-e-sbn` → scroll to find
- **Reksa Dana**: `~icn-service-reksadana` → scroll to find
- **DANA Plus**: `~icn-service-dana-plus` → scroll to find

### 🔄 IF SCROLLING FAILS:
1. **Try text search**: Look for service name text (e.g., "eMas DANA")
2. **Try partial selectors**: Content description containing partial match
3. **Check page source**: Get XML dump to see all available elements
4. **Document findings**: List all services discovered during search

### 💬 COMMUNICATION TEMPLATE:
```
"The service '[SERVICE_NAME]' was not immediately visible on the All Services page. 
I'll now systematically scroll down to search for it. 

🔍 Starting scroll search...
📸 Taking screenshot of current state
⬇️ Scroll attempt 1/5: [RESULT]
⬇️ Scroll attempt 2/5: [RESULT]
...
✅ Service found after scroll attempt [X]! Proceeding with test.
```

### ⚠️ NEVER SAY:
- "Service not found" (without scrolling first)
- "Element doesn't exist" (without comprehensive search)
- "Test case is broken" (without trying alternatives)

### ✅ ALWAYS DO:
- **Scroll systematically** (up to 5 attempts)
- **Document with screenshots** (before, during, after)
- **Try alternative selectors** if direct search fails
- **Report progress clearly** to user
- **Be patient and persistent**

## 🚀 Quick Test: @NTC-44101 (eMas DANA)
```bash
# Current Status: On All Services page
# Target: Find "~icn-service-emas" selector
# Action: Scroll down systematically until found
# Expected: Service icon clickable → proceeds to next step
```

---
**Remember**: Services on All Services page are in a scrollable grid. Most services require scrolling to locate. This is NORMAL behavior, not a test failure.