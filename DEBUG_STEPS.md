# 🔧 Console+ Debug Instructions - "Nothing Happens" Issue

## ✅ Fresh Build with Enhanced Logging

I've rebuilt the extension with **extensive debug logging** to help us find exactly what's happening.

---

## 📍 Step 1: Reload the Extension

1. Go to: `chrome://extensions/`
2. Find "Console+ for Salesforce"
3. Click the **refresh icon 🔄** to reload
4. Wait 2-3 seconds

---

## 🔍 Step 2: Open Service Worker Console

This is where we'll see what's happening:

1. Still on `chrome://extensions/`
2. Find Console+
3. Look for a link that says **"Inspect views: service worker"**
4. Click it → A new DevTools window opens
5. Make sure you're on the **"Console"** tab

**You should see:**
```
🎯 Console+ service worker loaded
```

If you don't see this, the service worker didn't load. Try:
- Refresh the extension again
- Check for red errors in the console

---

## 🧪 Step 3: Test the Extension

Now, with the service worker console open:

1. **Open a new tab**
2. **Go to Salesforce:**
   - Option A: `https://login.salesforce.com` → Log in
   - Option B: Your org URL (e.g., `https://yourorg.my.salesforce.com`)
3. **Make sure you're fully logged in**
4. **Click the Console+ icon** in your toolbar

---

## 📊 Step 4: Read the Debug Output

Watch the service worker console. You should see detailed output like this:

### ✅ **SUCCESS** looks like:
```
═══════════════════════════════════════
🚀 Console+ icon clicked
Time: 2026-02-14T...
Tab URL: https://yourorg.salesforce.com
Tab ID: 123
═══════════════════════════════════════
Step 1: Checking if on Salesforce domain...
✅ Step 1: On Salesforce domain ✓
Step 2: Extracting session...
  🔍 Extracting session from: https://yourorg.salesforce.com
  🌐 Instance URL: https://yourorg.my.salesforce.com
  🍪 Trying cookie: sid...
  ✅ Found cookie: sid
  📝 Cookie value length: 112
✅ Step 2: Session extracted ✓
Session ID: A00!ARoA...
Instance URL: https://yourorg.my.salesforce.com
Step 3: Storing session...
✅ Step 3: Session stored ✓
Step 4: Opening console window...
  📂 Opening console window...
  🖥️ Getting display info...
  📊 Found 1 display(s)
  📐 Primary display work area: ...
  📏 Window dimensions: { width: ..., height: ..., left: ..., top: ... }
  🚀 Creating new window...
  ✅ Created new console window, ID: 456
✅ Step 4: Window opened ✓
═══════════════════════════════════════
🎉 Console+ launched successfully!
═══════════════════════════════════════
```

### ❌ **FAILURE** might show:

#### Problem 1: Not on Salesforce
```
❌ ERROR: Not on a Salesforce domain
Current URL: https://www.google.com
```
**Fix:** Navigate to a Salesforce org

#### Problem 2: No Session
```
❌ ERROR: No session found
  🍪 Trying cookie: sid...
  ❌ Cookie sid not found
  🍪 Trying cookie: oid...
  ❌ Cookie oid not found
```
**Fix:** Make sure you're logged into Salesforce

#### Problem 3: Permission Error
```
❌ FATAL ERROR: Error: ...permissions...
```
**Fix:** See Step 5 below

---

## 🔐 Step 5: Check Permissions

If you see permission errors:

1. Go to `chrome://extensions/`
2. Find Console+
3. Click **"Details"**
4. Scroll down to **"Site access"**
5. Make sure it's set to:
   - "On all sites" **OR**
   - "On specific sites" with `*://*.salesforce.com/*` added

---

## 🎯 Step 6: Report What You See

Please share:

1. **Screenshot of service worker console** after clicking the icon
2. **The Salesforce URL** you're on (e.g., `https://yourorg.lightning.force.com`)
3. **Any error messages** (copy the exact text)

---

## 🆘 Common Issues & Quick Fixes

### Issue: "Inspect views: service worker" link doesn't appear
**Cause:** Service worker crashed or didn't load
**Fix:**
```
1. Remove the extension
2. Close Chrome completely
3. Reopen Chrome
4. Go to chrome://extensions/
5. Load unpacked again from: /Users/rahuljangir/rahul work/dist/
```

### Issue: Alert says "Not on Salesforce domain"
**Cause:** You're on the wrong page
**Fix:** Navigate to one of these:
- `https://login.salesforce.com`
- `https://yourorg.my.salesforce.com`
- `https://yourorg.lightning.force.com`
- Any internal Salesforce page (Setup, Objects, etc.)

**NOT these:**
- `https://www.salesforce.com` (marketing site)
- `https://developer.salesforce.com` (dev site)
- `https://trailhead.salesforce.com`

### Issue: Alert says "No session found"
**Cause:** Not logged in or session expired
**Fix:**
1. Log out of Salesforce
2. Log back in
3. Navigate to Setup or any internal page
4. Try clicking Console+ icon again

### Issue: No alert, no console output, nothing
**Cause:** Extension icon might not be properly registered
**Fix:**
1. Check if Console+ is enabled in chrome://extensions/
2. Try disabling and re-enabling it
3. Refresh the extension
4. If still nothing, the icon click listener isn't working

---

## 💡 Test Cookie Access Manually

If you see "No session found", test cookie access:

1. **Open service worker console**
2. **Paste this code:**

```javascript
// Test cookie access
(async () => {
  const tab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  console.log('Current tab:', tab.url);
  
  const cookie = await chrome.cookies.get({
    url: tab.url,
    name: 'sid'
  });
  
  console.log('Cookie result:', cookie);
  
  if (cookie) {
    console.log('✅ Cookie found! Value length:', cookie.value.length);
  } else {
    console.log('❌ Cookie NOT found');
    
    // List all cookies for this domain
    const allCookies = await chrome.cookies.getAll({ url: tab.url });
    console.log('All cookies for this domain:', allCookies.map(c => c.name));
  }
})();
```

This will show if Chrome can access Salesforce cookies.

---

## 📍 What I Added to Help Debug

The new build includes:

✅ Step-by-step console logging  
✅ Detailed error messages  
✅ Cookie detection logging  
✅ Window creation logging  
✅ User-friendly error alerts  
✅ Exact error locations  

Every action now logs to the console so we can see exactly where it fails!

---

## 🎯 Next Steps

1. Reload the extension
2. Open service worker console
3. Click the icon
4. **Share the console output with me**

The debug output will tell us exactly what's happening! 🔍
