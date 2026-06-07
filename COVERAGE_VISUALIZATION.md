# Coverage Visualization Feature

## Overview

After running tests, you can now visualize **line-by-line code coverage** directly in the Monaco editor with:
- ✅ **Green highlighting** for covered lines
- ❌ **Red highlighting** for uncovered lines
- 📊 **Coverage percentage** badge in the toolbar
- 🎨 **Toggle button** to show/hide coverage

---

## How It Works

### 1. **Run Tests**

When you run a test class:

```
1. Click "▶️ Run Tests" button (only visible on test classes)
2. Test runs asynchronously
3. Results appear in the bottom panel with:
   - ✅ Pass/Fail for each test method
   - 📊 Coverage percentage
   - 🕐 Run times
   - 📝 Error messages and stack traces (if any)
```

### 2. **Automatic Coverage Fetching**

After tests complete, the extension automatically:
- Fetches coverage data from Salesforce API (`ApexCodeCoverage`)
- Stores coverage for all classes covered by the test
- Shows coverage percentage in the bottom panel

### 3. **Visualize Coverage**

For any class with coverage data:

**Toolbar shows:**
- Coverage badge: `75% Coverage` (example)
- Button: `🎨 Show Coverage` / `🎨 Hide Coverage`

**When you click "Show Coverage":**
- Editor lines get colored backgrounds:
  - 🟢 **Green** = Line is covered by tests
  - 🔴 **Red** = Line is NOT covered by tests
- Gutter icons appear:
  - ✅ Green checkmark = Covered
  - ❌ Red X = Uncovered
- Hover over any line to see tooltip:
  - "✅ This line is covered by tests"
  - "❌ This line is NOT covered by tests"

---

## User Experience Flow

### Scenario: Testing AccountController

1. **Open AccountControllerTest.cls**
   - Tab bar shows: `AccountControllerTest`
   - Toolbar shows: `▶️ Run Tests` button

2. **Click "Run Tests"**
   - Loading animation shows
   - Bottom panel shows "Running tests..."

3. **Tests Complete**
   - Bottom panel "Test Results" tab shows:
     ```
     Total: 5  |  Passed: 4  |  Failed: 1  |  Time: 234ms
     
     ✅ testGetAccount - 45ms
     ✅ testCreateAccount - 67ms
     ✅ testUpdateAccount - 52ms
     ❌ testDeleteAccount - 38ms
        Error: System.DmlException: Delete failed
        Stack: Class.AccountController.deleteAccount: line 42
     ✅ testBulkInsert - 32ms
     ```
   
   - "Coverage" tab shows:
     ```
     📊 AccountController Coverage
     
     Total Lines: 150
     Covered: 112
     Uncovered: 38
     Percentage: 75%
     Lines to 75%: Already at target! ✅
     ```

4. **View Coverage in Code**
   - Click on `AccountController` in sidebar (or its tab)
   - Toolbar now shows:
     - Badge: `75% Coverage`
     - Button: `🎨 Show Coverage`
   - Click "Show Coverage"
   - Editor highlights lines:
     - Methods with test coverage = green
     - Uncovered error handling = red
     - Uncovered edge cases = red

5. **Fix Coverage**
   - Identify red (uncovered) lines
   - Add test cases to cover them
   - Run tests again
   - Coverage increases!

---

## API Integration

### Data Flow

```
1. Run Tests
   POST /tooling/runTestsAsynchronous/
   → Returns: jobId
   
2. Poll Test Status
   GET /tooling/query?q=SELECT Id, Status FROM ApexTestQueueItem WHERE ParentJobId = 'jobId'
   → Returns: Status ('Completed', 'Processing', etc.)
   
3. Fetch Test Results
   GET /tooling/query?q=SELECT Id, MethodName, Outcome, Message, StackTrace, RunTime 
                        FROM ApexTestResult WHERE QueueItemId IN (queueIds)
   → Returns: Test results for each method
   
4. Fetch Coverage
   GET /tooling/query?q=SELECT ApexClassOrTriggerId, NumLinesCovered, NumLinesUncovered, Coverage
                        FROM ApexCodeCoverage WHERE ApexClassOrTriggerId = 'classId'
   → Returns: Coverage data with line-by-line breakdown
```

### Coverage Data Structure

```typescript
interface CoverageResult {
  ApexClassOrTriggerId: string;  // Class ID
  NumLinesCovered: number;        // e.g., 112
  NumLinesUncovered: number;      // e.g., 38
  Coverage: CoverageLocation[];   // Line-by-line breakdown
}

interface CoverageLocation {
  line: number;    // Line number (1-indexed)
  covered: 0 | 1;  // 0 = not covered, 1 = covered
}
```

**Example:**
```json
{
  "ApexClassOrTriggerId": "01p...",
  "NumLinesCovered": 112,
  "NumLinesUncovered": 38,
  "Coverage": [
    { "line": 1, "covered": 1 },  // ✅ Covered
    { "line": 2, "covered": 1 },  // ✅ Covered
    { "line": 3, "covered": 0 },  // ❌ Not covered
    { "line": 15, "covered": 1 }, // ✅ Covered
    { "line": 42, "covered": 0 }  // ❌ Not covered (error line)
  ]
}
```

---

## Monaco Editor Integration

### Decorations API

We use Monaco's `deltaDecorations` to highlight lines:

```typescript
const decorations = classCoverage.Coverage.map(loc => {
  const isCovered = loc.covered === 1;
  return {
    range: new monaco.Range(loc.line, 1, loc.line, 1),
    options: {
      isWholeLine: true,
      className: isCovered ? 'line-covered' : 'line-uncovered',
      glyphMarginClassName: isCovered ? 'glyph-covered' : 'glyph-uncovered',
      hoverMessage: { 
        value: isCovered 
          ? '✅ This line is covered by tests' 
          : '❌ This line is NOT covered by tests' 
      }
    }
  };
});

editorInstance.deltaDecorations(previousDecorations, decorations);
```

### CSS Styling

```css
/* Covered lines - green */
.line-covered {
  background: rgba(40, 167, 69, 0.15) !important;
  border-left: 3px solid #28a745 !important;
}

/* Uncovered lines - red */
.line-uncovered {
  background: rgba(220, 53, 69, 0.15) !important;
  border-left: 3px solid #dc3545 !important;
}

/* Gutter icons */
.glyph-covered {
  /* Green checkmark SVG */
}

.glyph-uncovered {
  /* Red X SVG */
}
```

---

## State Management

### Zustand Store

```typescript
// State
coverageVisible: boolean;  // Is coverage visualization active?
coverage: Map<string, CoverageResult>;  // Coverage data for all classes

// Actions
setCoverageVisible: (visible: boolean) => void;
fetchCoverage: (classId: string) => Promise<void>;
runTests: (classId: string) => Promise<void>;  // Also fetches coverage
```

### React Component

```typescript
const { coverage, coverageVisible, setCoverageVisible } = useApexStore();

// Get coverage for current class
const classCoverage = coverage.get(classId);
const hasCoverage = classCoverage && classCoverage.Coverage && classCoverage.Coverage.length > 0;

// Calculate percentage
const percentage = Math.round(
  (classCoverage.NumLinesCovered / 
   (classCoverage.NumLinesCovered + classCoverage.NumLinesUncovered)) * 100
);

// Toggle coverage
const toggleCoverage = () => {
  setCoverageVisible(!coverageVisible);
};
```

---

## UI Components

### 1. **Editor Toolbar**

```tsx
<div className="toolbar-left">
  <span className="toolbar-filename">{className}.cls</span>
  {hasCoverage && (
    <span className="coverage-badge">
      {percentage}% Coverage
    </span>
  )}
</div>
<div className="toolbar-right">
  {hasCoverage && (
    <button 
      className={`toolbar-btn toolbar-btn-coverage ${coverageVisible ? 'active' : ''}`}
      onClick={toggleCoverage}
    >
      {coverageVisible ? '🎨 Hide Coverage' : '🎨 Show Coverage'}
    </button>
  )}
  <button onClick={handleSave}>💾 Save</button>
  {isTestClass && (
    <button onClick={handleRunTests}>▶️ Run Tests</button>
  )}
</div>
```

### 2. **Bottom Panel - Coverage Tab**

Shows aggregate coverage statistics:
- Total lines
- Covered lines
- Uncovered lines
- Percentage
- Lines needed to reach 75%
- Visual progress bar

### 3. **Bottom Panel - Test Results Tab**

Shows per-method results:
- Method name
- Pass/Fail status
- Run time
- Error message (if failed)
- Stack trace (if failed)

---

## Benefits

### For Developers

1. **Visual Feedback** - Instantly see which code is tested
2. **Gap Identification** - Easily spot untested code paths
3. **Test-Driven Development** - See coverage grow as you add tests
4. **Code Quality** - Ensure critical paths are covered
5. **Debugging** - Understand which lines run during tests

### For Teams

1. **Coverage Standards** - Ensure 75% minimum coverage
2. **Code Reviews** - Verify new code has tests
3. **Refactoring Confidence** - Know what's covered before changing code
4. **Documentation** - Coverage shows which code is validated

---

## Example Workflow

### Finding Uncovered Code

```apex
public class AccountController {
    public static Account getAccount(Id accountId) {
        // Line 5 - ✅ COVERED (tested in testGetAccount)
        if (accountId == null) {
            // Line 7 - ❌ NOT COVERED (no test for null input)
            throw new IllegalArgumentException('Account ID cannot be null');
        }
        
        // Line 11 - ✅ COVERED
        List<Account> accounts = [SELECT Id, Name FROM Account WHERE Id = :accountId];
        
        // Line 14 - ❌ NOT COVERED (no test for empty result)
        if (accounts.isEmpty()) {
            return null;
        }
        
        // Line 19 - ✅ COVERED
        return accounts[0];
    }
}
```

**Coverage visualization shows:**
- Lines 5, 11, 19 = 🟢 Green (covered)
- Lines 7, 14 = 🔴 Red (not covered)

**Action items:**
1. Add test for null accountId → covers line 7
2. Add test for non-existent account → covers line 14
3. Re-run tests → coverage increases from 60% to 100%

---

## Tips & Tricks

### 1. Focus on Red Lines

When coverage is < 75%:
- Look at red lines in the editor
- Identify patterns:
  - Error handling not tested?
  - Edge cases not covered?
  - Conditional branches missing?

### 2. Use Coverage to Guide Testing

Instead of guessing what to test:
1. Run existing tests
2. Turn on coverage visualization
3. See what's red
4. Write tests for red lines
5. Repeat until green!

### 3. Toggle Coverage On/Off

- Turn ON when writing tests
- Turn OFF when editing code (less distraction)
- Toggle shortcut: Click the toolbar button

### 4. Check Multiple Classes

After running a test:
- Test class itself has no coverage (it's the test!)
- But classes it tests have coverage
- Open those classes and click "Show Coverage"

---

## Limitations

1. **Coverage Data Freshness**
   - Coverage only updates after running tests
   - Manual refresh: run tests again

2. **Visual Clutter**
   - Red/green lines can be distracting
   - Solution: Toggle off when not needed

3. **No Partial Line Coverage**
   - Salesforce reports whole-line coverage
   - A line is either fully covered (1) or not (0)

4. **Test Classes Show No Coverage**
   - Test classes themselves don't have coverage data
   - Only the classes they test have coverage

---

## Future Enhancements

Potential improvements:

1. **Coverage Diff**
   - Show coverage changes before/after test changes
   - Highlight newly covered lines

2. **Coverage Heat Map**
   - Color intensity based on execution count
   - Darker green = executed more times

3. **Quick Fix Actions**
   - Click uncovered line → "Generate test case"
   - AI suggests test to cover that line

4. **Coverage Trends**
   - Track coverage over time
   - Graph showing coverage history

5. **Branch Coverage**
   - Not just line coverage
   - Show which if/else branches are covered

---

## Summary

The coverage visualization feature provides:

✅ **Clear visual feedback** - See covered/uncovered lines at a glance  
✅ **In-editor integration** - No need to switch to another tool  
✅ **Toggle on/off** - Show coverage when needed, hide when not  
✅ **Comprehensive data** - Percentage, line counts, and visual indicators  
✅ **Test-driven workflow** - Write tests → See green → Profit!  

This helps developers write better tests and achieve higher code coverage with less guesswork! 🎉
