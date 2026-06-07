# 🚀 Quick Start - Console+ Installation

## Step-by-Step Installation (2 Minutes)

### 1️⃣ Open Extensions Page
```
Chrome: chrome://extensions/
Edge:   edge://extensions/
```
Or click puzzle icon 🧩 → "Manage Extensions"

### 2️⃣ Enable Developer Mode
Toggle the switch in the **top-right corner** → ON (Blue)

### 3️⃣ Load the Extension
1. Click **"Load unpacked"** button
2. Navigate to: `/Users/rahuljangir/rahul work/dist/`
3. Click **"Select"** or **"Open"**

### 4️⃣ Verify Installation
✅ You should see: "Console+ for Salesforce v1.2.3"
✅ Status: Enabled

### 5️⃣ Pin the Icon (Optional but Recommended)
- Click puzzle icon 🧩
- Find "Console+ for Salesforce"
- Click the pin 📌 icon
- Icon will appear in your toolbar

---

## 🧪 Quick Test (1 Minute)

1. **Open Salesforce** → Log in to any org
2. **Click Console+ Icon** → New window opens
3. **Wait** → Classes load in sidebar
4. **Click any class** → Code appears in editor
5. **Check bottom panel** → Should see "Coverage" and "Test Results" tabs

✅ **Success!** Extension is working!

---

## 📍 Extension Location

The built extension is at:
```
/Users/rahuljangir/rahul work/dist/
```

This folder contains:
- `manifest.json` (Extension config)
- `index.html` (Main app)
- `service-worker-loader.js` (Background script)
- `assets/` (JavaScript & CSS)
- `icons/` (Logo and icons)
- `animations/` (Loading animation)

---

## 🔄 If You Need to Rebuild

```bash
cd "/Users/rahuljangir/rahul work"
npm run build
```

Then reload the extension:
1. Go to `chrome://extensions/`
2. Find Console+
3. Click the refresh icon 🔄

---

## ⚡ Key Features to Test

### ✨ New Unified Bottom Panel
- Two tabs: Coverage & Test Results
- Resizable (drag the top edge)
- Collapsible (click ▼ button)
- **Test results persist when switching classes!**

### 🎯 Test the Main Feature
1. Select a test class
2. Click "▶️ Run Tests"
3. Wait for results to appear
4. Switch to another class
5. **Results should still be visible!** ✅

---

## 📞 Need More Details?

See the complete `TESTING_GUIDE.md` for:
- Detailed test scenarios
- Troubleshooting steps
- Feature checklist
- Common issues and solutions

---

**Build:** Fresh dist created ✅
**Date:** February 14, 2026
**Version:** 1.2.3
**Status:** Ready for testing! 🚀
