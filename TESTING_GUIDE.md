# Quick Testing Guide - Console+ v1.3.0

## 🚀 Load the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `dist/` folder from your project
5. Pin the extension to your toolbar for easy access

## ✅ Test All Fixes

### 1. Test Save (Most Critical!)

1. Go to any Salesforce org
2. Click the Console+ extension icon
3. Select any Apex class from the sidebar
4. Make a change to the code (add a comment, etc.)
5. Press `Ctrl+S` (Windows/Linux) or `Cmd+S` (Mac)
6. **Expected:** You should see "✅ Class saved successfully" in the browser console
7. **Verify:** Go to Setup > Apex Classes and check the class was actually saved

### 2. Test Test Results

1. Open a test class (ends with "Test" or has `@isTest`)
2. Click the "▶️ Run Tests" button
3. Wait for the loading animation
4. **Expected:** Bottom panel shows:
   - Test results with pass/fail for each method
   - Run times
   - Stack traces for failures
   - Coverage percentage
   - Lines needed to reach 75%

### 3. Test Search

1. In the sidebar, type in the search box
2. **Expected:** Class list filters as you type
3. Click the × button to clear
4. **Expected:** Search clears and all classes show again

### 4. Test Multi-Tab

1. Click on 3-4 different classes in the sidebar
2. **Expected:** Tabs appear at the top showing class names
3. Click different tabs to switch between them
4. **Expected:** Editor shows the correct code for each tab
5. Edit code in one tab (don't save)
6. **Expected:** Tab shows a ● indicator (dirty)
7. Click the × on a tab to close it
8. **Expected:** Tab closes, switches to adjacent tab

### 5. Test Code Refresh

1. Go to Setup > Apex Classes in Salesforce
2. Edit a class and save it there
3. In Console+, if the tab is open, close it
4. Click the class again in the sidebar
5. **Expected:** You see the latest code from Salesforce

## 🐛 What If Something Doesn't Work?

### Save Issues
- Open browser console (F12)
- Try to save again
- Look for error messages
- Common issues:
  - Still getting permission error? The MetadataContainer might be disabled in your org
  - Compilation error? Check the error message - it should show line/column

### Test Results Not Showing
- Open browser console
- Look for API errors
- Check if the test class actually ran in Salesforce (Setup > Apex Test Execution)

### Tabs Not Working
- Check browser console for errors
- Try refreshing the extension window

## 📝 Report Issues

If you find any bugs, note:
1. What you were doing
2. What you expected
3. What actually happened
4. Any error messages in the browser console (F12)

## 🎉 All Working?

If everything works:
1. The extension is ready to use!
2. You can now work with multiple classes simultaneously
3. Save and test with confidence

---

**Enjoy Console+ v1.3.0! 🚀**
