# DANA App Tooltip Dismissal Quick Reference

## 🚨 CRITICAL RULE
**ALWAYS dismiss tooltips before ANY element interaction on DANA app**

## ⚡ Quick Dismissal Sequence (Copy-Paste Ready)

### Method 1: Automated Popup Handler (Fastest)
```javascript
await f1e_handle_popup({
  action: "dismiss", 
  timeout: 3000
});
```

### Method 2: Close Button Click (Most Reliable)
```javascript
await f1e_click_element({
  strategy: "xpath",
  selector: "//android.widget.ImageView[contains(@content-desc,'close') or contains(@content-desc,'dismiss') or contains(@content-desc,'×')]",
  timeout: 3000
});
```

### Method 3: Background Tap (Fallback)
```javascript
await f1e_click_element({
  strategy: "xpath",
  selector: "//android.widget.FrameLayout[@resource-id='android:id/content']",
  timeout: 2000
});
```

### Method 4: Back Button (Last Resort)
```javascript
await f1e_appium_press_back();
```

## 🔄 Complete Tooltip Handling Function

```javascript
async function dismissAllTooltips() {
  const methods = [
    // Method 1: Close button
    async () => await f1e_click_element({
      strategy: "xpath",
      selector: "//android.widget.ImageView[contains(@content-desc,'close') or contains(@content-desc,'dismiss') or contains(@content-desc,'×')]",
      timeout: 2000
    }),
    
    // Method 2: Popup handler
    async () => await f1e_handle_popup({
      action: "dismiss",
      timeout: 2000
    }),
    
    // Method 3: Background tap
    async () => await f1e_click_element({
      strategy: "xpath", 
      selector: "//android.widget.FrameLayout[@resource-id='android:id/content']",
      timeout: 2000
    }),
    
    // Method 4: Back button
    async () => await f1e_appium_press_back()
  ];

  for (let i = 0; i < methods.length; i++) {
    try {
      await methods[i]();
      console.log(`Tooltip dismissed using method ${i + 1}`);
      await f1e_get_screenshot({filename: `tooltip_dismissed_method_${i + 1}`});
      return true;
    } catch (error) {
      console.log(`Method ${i + 1} failed: ${error.message}`);
      continue;
    }
  }
  
  console.log("All tooltip dismissal methods failed");
  return false;
}
```

## 📋 Integration Checklist

### Before Every Major Action:
- [ ] Take screenshot to document current state
- [ ] Run tooltip dismissal function  
- [ ] Verify UI is clear with another screenshot
- [ ] Proceed with intended action

### Example Integration:
```javascript
// Before clicking eMas DANA service
await f1e_get_screenshot({filename: "before_tooltip_check"});
await dismissAllTooltips();
await f1e_get_screenshot({filename: "after_tooltip_dismissal"});

// Now safe to click target element
await f1e_click_element({
  strategy: "contentDescription",
  selector: "~icn-service-emas"
});
```

## 🎯 Common DANA Tooltip Patterns

### Text Patterns to Watch For:
- "Find other DANA features!"
- "Enter the keyword to search service you want to use"
- "New feature available"
- "Update notification"

### Element Patterns:
- Close buttons: ImageView with content-desc containing "close", "dismiss", "×"
- Overlay containers: FrameLayout, LinearLayout with transparency
- Text containers: TextView with promotional or help text

## 🚨 Emergency Troubleshooting

### If All Methods Fail:
1. **Get UI Dump**: `f1e_get_page_source()` to analyze structure
2. **Coordinate Click**: Get close button coordinates and click directly
3. **App Restart**: Kill and relaunch app as last resort
4. **Report Issue**: Document for development team if persistent

### Coordinate-Based Dismissal Example:
```javascript
// If you know close button coordinates (e.g., from screenshot)
await f1e_click_element({
  strategy: "xpath",
  selector: "//android.widget.FrameLayout[@resource-id='android:id/content']",
  coordinates: {x: 658, y: 249} // Close button coordinates
});
```

## 💡 Pro Tips

1. **Always screenshot before and after** tooltip dismissal for debugging
2. **Use shortest timeout** (2-3 seconds) to avoid long waits
3. **Try methods in order** - close button is usually most reliable
4. **Validate success** before proceeding with main test flow
5. **Document tooltip patterns** you discover for team knowledge

## 🔗 Related Files
- `intelligent-test-repair-agent.md` - Main automation guidance
- `all-services-scrolling-guidance.md` - All Services page specific guidance
- `agent-scrolling-quick-reference.md` - Quick scrolling reference