# Coverage Overview Panel - Feature Documentation

## 🎯 Overview

The **Coverage Overview Panel** is a new feature that displays all classes with coverage data in a comprehensive, sortable, filterable table. Inspired by Salesforce Inspector's coverage view, it provides a bird's-eye view of your org's test coverage.

---

## 🚀 How to Access

### Location
Bottom Panel → **🎯 All Classes** tab

### Three Tabs Available:
1. **📊 Current Class** - Coverage for the currently open class
2. **🧪 Test Results** - Test execution results for the current test class
3. **🎯 All Classes** - Coverage overview for all classes (NEW!)

---

## ✨ Features

### 1. **Comprehensive Coverage Table**

Shows all classes with coverage data in a table format:

| Column | Description |
|--------|-------------|
| **Class Name** | Name of the Apex class + badge if needs work |
| **Coverage** | Visual progress bar with percentage |
| **Lines** | Total number of lines in the class |
| **Covered / Uncovered** | Breakdown: `112 ✓ / 38 ✗` |
| **Action** | "👁️ View Code" button |

### 2. **Smart Sorting**

Two sorting options:
- **Coverage (Low to High)** - Shows worst coverage first (default)
- **Name (A-Z)** - Alphabetical order

**Why "worst first"?**
- Quickly identify classes that need attention
- Prioritize fixing low-coverage classes
- Meet the 75% coverage requirement faster

### 3. **Flexible Filtering**

Filter by minimum coverage:
- **All Classes** - Show everything
- **≥ 25%** - Hide classes with very low coverage
- **≥ 50%** - Show only moderately covered classes
- **≥ 75%** - Show only classes at target

### 4. **Summary Statistics**

Three quick stats at the top:
- **📈 Average** - Average coverage across all classes
- **✅ At Target** - Number of classes ≥ 75%
- **⚠️ Needs Work** - Number of classes < 75%

### 5. **Visual Indicators**

**Progress Bars:**
- 🟢 **Green (75%+)** - Good coverage
- 🟡 **Yellow (50-74%)** - Medium coverage
- 🔴 **Red (<50%)** - Needs work

**Badges:**
- Red badge shows "X% needed" to reach 75%
- Example: `[15% needed]` means class needs 15% more coverage

**Row Highlighting:**
- Classes under 75% have a red left border
- Hover effect highlights the row

### 6. **"View Code" Button**

Click the **👁️ View Code** button to:
1. Open the class in a new tab (if not already open)
2. **Automatically enable coverage visualization**
3. See green/red line highlighting immediately
4. "Hide Coverage" button appears in the toolbar

---

## 🎨 User Experience Flow

### Scenario: Reviewing Coverage After Running Tests

1. **Run a test class**
   ```
   Open: AccountControllerTest.cls
   Click: ▶️ Run Tests
   ```

2. **Check test results**
   ```
   Bottom Panel → 🧪 Test Results tab
   See: ✅ 4 passed, ❌ 1 failed
   ```

3. **Switch to Coverage Overview**
   ```
   Click: 🎯 All Classes tab
   See: Table with all covered classes
   ```

4. **Identify problem classes**
   ```
   Table sorted by coverage (worst first)
   
   Class Name              Coverage    Lines   Covered/Uncovered   Action
   ───────────────────────────────────────────────────────────────────────
   TriggerDispatcher       [47%] 🔴   150     71 ✓ / 79 ✗        [View Code]
                           [28% needed]
   
   LightningController     [60%] 🟡   82      49 ✓ / 33 ✗        [View Code]
                           [15% needed]
   
   AccountSelector         [78%] 🟢   125     98 ✓ / 27 ✗        [View Code]
   
   AccountService          [85%] 🟢   94      80 ✓ / 14 ✗        [View Code]
   ```

5. **Fix the worst class first**
   ```
   Click: [View Code] for TriggerDispatcher
   
   Result:
   - TriggerDispatcher tab opens
   - Coverage visualization is ON
   - Red lines show uncovered code
   - Can see exactly what needs testing
   ```

6. **Write tests**
   ```
   - See red lines in editor
   - Identify uncovered error handling
   - Write new test methods
   - Run tests again
   ```

7. **Verify improvement**
   ```
   Bottom Panel → 🎯 All Classes
   TriggerDispatcher now shows: [76%] 🟢
   Badge removed (reached target!)
   ```

---

## 📊 Design & Layout

### Table Design

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 Code Coverage Overview                    [🔄 Load Coverage]│
├─────────────────────────────────────────────────────────────────┤
│  📈 Average    ✅ At Target    ⚠️ Needs Work                    │
│      67%            15              8                           │
├─────────────────────────────────────────────────────────────────┤
│  Sort: [Coverage ▼]    Min Coverage: [All Classes ▼]           │
├─────────────────────────────────────────────────────────────────┤
│ Class Name       │ Coverage         │ Lines│ Covered/Uncov│ Act│
├──────────────────┼──────────────────┼──────┼──────────────┼────┤
│ TriggerDispatch  │████████░░░░ 47%  │  150 │ 71✓ / 79✗   │ 👁️ │
│ [28% needed]     │                  │      │              │    │
├──────────────────┼──────────────────┼──────┼──────────────┼────┤
│ Lightning...     │████████████░ 60% │   82 │ 49✓ / 33✗   │ 👁️ │
│ [15% needed]     │                  │      │              │    │
├──────────────────┼──────────────────┼──────┼──────────────┼────┤
│ AccountSelector  │██████████████ 78%│  125 │ 98✓ / 27✗   │ 👁️ │
└─────────────────────────────────────────────────────────────────┘
 ■ ≥75% (Good)   ■ 50-74% (Medium)   ■ <50% (Needs Work)
```

### Color Scheme

**Matches Extension Theme:**
- Background: `#1e1e1e` (dark)
- Panels: `#252526` (slightly lighter)
- Borders: `#3c3c3c` (subtle)
- Text: `#cccccc` (light gray)
- Accent: `#007acc` (blue)

**Coverage Colors:**
- Good (≥75%): Green `#28a745`
- Medium (50-74%): Yellow `#ffc107`
- Bad (<50%): Red `#dc3545`

---

## 🔧 Technical Implementation

### Component Structure

```
CoverageOverview.tsx
├── Header
│   ├── Title & Subtitle
│   └── Load Coverage Button
├── Summary Stats (3 cards)
│   ├── Average Coverage
│   ├── Classes At Target
│   └── Classes Needing Work
├── Filters
│   ├── Sort Dropdown
│   └── Min Coverage Dropdown
└── Coverage Table
    ├── Table Header (sticky)
    ├── Table Body (scrollable)
    │   └── Coverage Rows (map)
    │       ├── Class Name & Badge
    │       ├── Progress Bar
    │       ├── Line Count
    │       ├── Covered/Uncovered
    │       └── View Code Button
    └── Legend
```

### Data Flow

1. **Data Source**: `useApexStore().coverage` (Map<classId, CoverageResult>)
2. **Transform**: Map classes + coverage → table rows
3. **Filter**: By minimum coverage threshold
4. **Sort**: By coverage % or name
5. **Render**: Table with visual indicators

### State Management

```typescript
// Zustand Store
const {
  classes,              // All Apex classes
  coverage,             // Map<classId, CoverageResult>
  openTab,              // Opens a class tab
  setCoverageVisible,   // Enables coverage visualization
  fetchAllCoverage,     // Loads all coverage data
  allCoverageLoaded     // Boolean flag
} = useApexStore();

// Local Component State
const [sortBy, setSortBy] = useState('coverage');
const [filterThreshold, setFilterThreshold] = useState(0);
```

---

## 🎯 Use Cases

### 1. **Post-Deployment Coverage Check**

After deploying tests:
```
1. Load all coverage: [🔄 Load All Coverage]
2. Review summary: "Average: 67%, 8 classes need work"
3. Filter: Min Coverage ≥ 0% (show all)
4. Sort: Coverage (Low to High)
5. Identify: Classes under 75%
6. Fix: Click View Code on each
```

### 2. **Pre-Production Validation**

Before going to production:
```
1. Open: Coverage Overview
2. Filter: Min Coverage ≥ 75%
3. Check: All classes shown meet requirement
4. Fix: Any classes not shown (< 75%)
```

### 3. **Code Review Coverage Assessment**

During PR review:
```
1. Run: All affected test classes
2. Check: Coverage Overview
3. Verify: New classes have good coverage
4. Request: More tests if coverage is low
```

### 4. **Refactoring Safety Check**

Before refactoring:
```
1. Check: Current coverage for target class
2. Refactor: Make changes
3. Run: Tests again
4. Compare: Coverage before/after
5. Ensure: Coverage didn't drop
```

---

## 🚀 Performance Optimizations

### Lazy Loading
- Coverage data only fetched when needed
- "Load All Coverage" button prevents auto-loading
- Reduces initial API calls

### Efficient Rendering
- Uses CSS Grid for table layout
- Virtualization not needed (typically <100 classes)
- Hover effects use CSS transitions

### Smart Sorting
- Sort in memory (fast)
- No API calls needed
- Instant feedback

---

## 📝 Best Practices

### 1. **Run Tests First**
- Coverage data comes from test execution
- No tests = No coverage = Empty table
- Always run tests before checking coverage

### 2. **Fix Worst First**
- Table sorted by coverage (worst first) by default
- Tackle low-coverage classes before good ones
- Fastest path to meeting 75% org requirement

### 3. **Use Filters Strategically**
- Show All: See everything (default)
- ≥ 50%: Focus on classes close to target
- ≥ 75%: Verify which classes meet requirement

### 4. **Click "View Code" Liberally**
- Opens class with coverage ON
- See exactly what to test
- No manual steps needed

---

## 🔮 Future Enhancements

Potential improvements:

1. **Export to CSV**
   - Download coverage data
   - Import into Excel/Sheets
   - Share with team

2. **Coverage Trends**
   - Track coverage over time
   - Show increase/decrease
   - Graph historical data

3. **Bulk Actions**
   - "Open All Under 75%" button
   - "Run All Tests" button
   - "Generate Tests" for uncovered code

4. **Search/Filter**
   - Search by class name
   - Filter by namespace
   - Group by package

5. **Coverage Heat Map**
   - Visual grid of all classes
   - Color intensity = coverage %
   - Click to view code

---

## 📊 Comparison with Current Coverage Tab

### **Current Class** Tab (existing)
- Shows coverage for ONE class
- Detailed stats (lines, percentage)
- Coverage progress bar
- Class-specific focus

### **All Classes** Tab (NEW!)
- Shows coverage for ALL classes
- Table with sortable columns
- Filterable by coverage threshold
- Org-wide overview
- "View Code" button per class
- Automatically enables visualization

**When to use each:**
- **Current Class**: Drill into one specific class
- **All Classes**: See org-wide coverage, identify gaps, prioritize work

---

## ✅ Summary

The Coverage Overview Panel provides:

✅ **Complete visibility** - See all classes with coverage in one view  
✅ **Smart prioritization** - Worst-first sorting highlights what needs attention  
✅ **Quick action** - One click to view code with coverage visualization  
✅ **Flexible filtering** - Show only what matters to you  
✅ **Summary stats** - Know org-wide coverage at a glance  
✅ **Beautiful design** - Matches extension theme, inspired by Salesforce Inspector  

This feature helps developers and teams:
- Meet Salesforce 75% coverage requirement
- Identify coverage gaps quickly
- Prioritize testing efforts
- Verify coverage before deployments
- Maintain high code quality

🎉 **Now you can see ALL your coverage data in one beautiful, actionable view!**
