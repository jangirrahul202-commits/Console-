# 🔍 Console+ Troubleshooting Guide

## Issue: Nothing happens when clicking the extension icon

Let's diagnose the problem step by step.

---

## Step 1: Check Service Worker Status

1. **Open Chrome Extensions Page:**
   - Go to: `chrome://extensions/`
   - Find "Console+ for Salesforce"

2. **Check Service Worker:**
   - Look for a link that says "Inspect views: service worker"
   - If you see it, click it
   - **If you DON'T see it**, the service worker hasn't loaded

3. **What to look for:**
   - A new DevTools window should open
   - Go to the "Console" tab
   - Look for any errors (red text)
   - Take a screenshot of what you see

---

## Step 2: Check Console Logs

After clicking the extension icon, check the service worker console for these messages:

**Expected messages:**
```
🎯 Console+ service worker loaded
🚀 Console+ icon clicked
✅ Session extracted: https://...
✅ Created new console window
```

**If you see errors instead:**
- Share the exact error message
- This will tell us what's failing

---

## Step 3: Manual Test

Let's test if the issue is with cookie extraction or window creation.

1. **Open the service worker console** (from Step 1)
2. **Run this test in the console:**

```javascript
// Test 1: Check if on Salesforce
const testUrl = 'https://your-org.salesforce.com';
console.log('Is Salesforce URL?', testUrl.includes('salesforce.com'));

// Test 2: Try to get cookies
chrome.cookies.get({
  url: testUrl,
  name: 'sid'
}, (cookie) => {
  console.log('Cookie found:', cookie ? 'YES' : 'NO');
  if (cookie) console.log('Session ID:', cookie.value);
});

// Test 3: Check permissions
chrome.permissions.contains({
  permissions: ['cookies', 'storage', 'tabs'],
  origins: ['*://*.salesforce.com/*', '*://*.force.com/*']
}, (hasPermissions) => {
  console.log('Has permissions:', hasPermissions);
});
```

---

## Step 4: Common Issues & Fixes

### Issue A: Service Worker Not Loading

**Symptom:** No "Inspect views" link in extensions page

**Fix:**
```bash
# Reload the extension
1. Go to chrome://extensions/
2. Find Console+
3. Click the refresh icon 🔄
4. Wait 2-3 seconds
5. Look for "Inspect views: service worker" link
```

### Issue B: Permissions Not Granted

**Symptom:** Error about permissions in console

**Fix:**
1. Go to `chrome://extensions/`
2. Click "Details" on Console+
3. Scroll to "Site access"
4. Make sure it's set to "On all sites" or "On specific sites"
5. Add `*://*.salesforce.com/*` if needed

### Issue C: Wrong URL Format

**Symptom:** "Not on a Salesforce domain" error

**Fix:**
- Make sure you're on a page like:
  - `https://login.salesforce.com`
  - `https://yourorg.my.salesforce.com`
  - `https://yourorg.lightning.force.com`
- NOT on: `https://www.salesforce.com` (marketing site)

### Issue D: Not Logged In

**Symptom:** "No session found" alert

**Fix:**
1. Make sure you're fully logged into Salesforce
2. Navigate to Setup or any internal Salesforce page
3. Try clicking the icon again

---

## Step 5: Enable Verbose Logging

Let's add more logging to see what's happening:

1. **Open service worker console**
2. **Paste this code to enable debug mode:**

```javascript
// Override console.log to show timestamp
const originalLog = console.log;
console.log = function(...args) {
  originalLog(new Date().toISOString(), ...args);
};

// Now click the extension icon and watch for logs
console.log('🔍 Debug mode enabled - click the extension icon now');
```

---

## Step 6: Check Specific Errors

### Error: "Extension context invalidated"
**Cause:** Extension was reloaded
**Fix:** Close all Console+ windows and refresh extension

### Error: "Cannot read properties of undefined"
**Cause:** Tab URL is undefined
**Fix:** Make sure you're on an active Salesforce tab

### Error: "Invalid value for bounds"
**Cause:** Display detection failed
**Fix:** We need to fix the window sizing logic

---

## Quick Diagnostic Script

Run this complete diagnostic in the service worker console:

```javascript
(async function diagnose() {
  console.log('=== Console+ Diagnostic ===');
  
  // Check current tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  console.log('1. Current Tab:', tabs[0]?.url || 'NONE');
  
  // Check permissions
  const perms = await chrome.permissions.getAll();
  console.log('2. Permissions:', perms);
  
  // Check if on SF
  const isSF = tabs[0]?.url?.includes('salesforce.com') || tabs[0]?.url?.includes('force.com');
  console.log('3. On Salesforce:', isSF);
  
  // Try to get cookie
  if (tabs[0]?.url) {
    const cookie = await chrome.cookies.get({
      url: tabs[0].url,
      name: 'sid'
    });
    console.log('4. Session Cookie:', cookie ? 'FOUND ✅' : 'NOT FOUND ❌');
  }
  
  // Check storage
  const storage = await chrome.storage.local.get(['session']);
  console.log('5. Stored Session:', storage.session || 'NONE');
  
  console.log('=== End Diagnostic ===');
})();
```

---

## What to Share for Help

If none of the above works, please share:

1. **Console Output:** Screenshot of service worker console after clicking icon
2. **Salesforce URL:** The URL you're on (e.g., `https://yourorg.lightning.force.com`)
3. **Chrome Version:** Check in `chrome://version/`
4. **Any Error Messages:** Exact text of any errors
5. **Extension Status:** Is it enabled? Any warnings?

---

## Emergency Fix: Rebuild with Debug Logging

If nothing above helps, I can add extensive debug logging to the service worker.

Let me know what you find in the service worker console and we'll fix it! 🔧
