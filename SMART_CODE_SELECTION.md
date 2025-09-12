# Smart Code Selection & Auto-Instructions

## 🧠 **Intelligent Selection Handling**

The toolbar now waits intelligently for users to complete their selection and auto-populates instructions with the selected code.

## 🎯 **Smart Behavior Flow**

### **1. User Starts Selecting:**

```
User: Starts dragging to select code
Tool: • Hides toolbar immediately
      • Sets isUserSelecting = true
      • Waits patiently...
```

### **2. User Continues Selecting:**

```
User: Extends selection, adjusts boundaries
Tool: • Toolbar remains hidden
      • Clears previous timeouts
      • Starts new 800ms countdown
```

### **3. User Finishes (800ms of no selection changes):**

```
User: Stops selecting for 800ms
Tool: • Shows toolbar at selection end
      • Auto-populates instructions
      • Ready for user input
```

## 📝 **Auto-Instruction Generation**

### **Examples:**

#### **Short Selection:**

```python
# User selects: print("hello")
# Auto-instruction: Fix this code: "print("hello")"
```

#### **Long Selection (truncated):**

```sql
# User selects: SELECT u.name, u.email, u.created_at FROM users u WHERE u.active = 1 AND u.deleted_at IS NULL
# Auto-instruction: Fix this code: "SELECT u.name, u.email, u.created_at FROM users u WH..."
```

### **Template Format:**

```javascript
const codeContext = `Fix this code: "${
  selectedText.length > 50
    ? selectedText.substring(0, 50) + '...'
    : selectedText
}"`;
```

## ⏱️ **Timing & UX**

### **Why 800ms Delay?**

- **Too short (200ms):** Toolbar flickers during selection
- **Too long (2000ms):** Feels unresponsive
- **Just right (800ms):** Smooth, responsive feel

### **User Experience:**

```
0ms    → User starts selecting
100ms  → User extends selection (toolbar stays hidden)
400ms  → User adjusts selection (countdown resets)
500ms  → User stops selecting (countdown starts)
1300ms → Toolbar appears with auto-instructions (500 + 800)
```

## 🎨 **Visual Flow**

### **Before (Immediate):**

```
User selects → Toolbar appears instantly → Flickers during selection ❌
```

### **After (Smart):**

```
User selects → Waits patiently → User finishes → Toolbar with context ✅
```

## 🔧 **Implementation Details**

### **State Management:**

```javascript
const [selectionTimeout, setSelectionTimeout] = useState(null);
const [isUserSelecting, setIsUserSelecting] = useState(false);
```

### **Selection Handler:**

```javascript
editor.onDidChangeCursorSelection((e) => {
  // Clear previous timeout
  if (selectionTimeout) clearTimeout(selectionTimeout);

  // Hide toolbar during active selection
  setShowCorrectionToolbar(false);
  setIsUserSelecting(true);

  // Wait 800ms after selection stops
  const timeout = setTimeout(() => {
    setIsUserSelecting(false);

    // Auto-populate with selected code
    const codeContext = `Fix this code: "${selectedText}"`;
    setUserInstructions(codeContext);

    // Show toolbar
    setShowCorrectionToolbar(true);
  }, 800);

  setSelectionTimeout(timeout);
});
```

### **Cleanup:**

```javascript
useEffect(() => {
  return () => {
    if (selectionTimeout) clearTimeout(selectionTimeout);
  };
}, [selectionTimeout]);
```

## 🎯 **User Benefits**

### **1. No Flickering:**

- ✅ Toolbar doesn't appear/disappear during selection
- ✅ Smooth, polished experience

### **2. Smart Context:**

- ✅ Instructions pre-filled with selected code
- ✅ User can immediately see what will be processed
- ✅ Easy to edit and customize

### **3. Intelligent Timing:**

- ✅ Waits for user to complete their thought
- ✅ Doesn't interrupt the selection process
- ✅ Appears exactly when needed

### **4. Better Workflow:**

```
Old: Select → Toolbar → Click Instructions → Type context
New: Select → Wait → Toolbar with context ready → Edit if needed
```

## 🚀 **Advanced Features**

### **Contextual Instructions:**

Future enhancements could generate even smarter instructions:

```javascript
// Based on language and code pattern
if (language === 'sql' && selectedText.includes('SELECT *')) {
  instruction = 'Replace SELECT * with specific columns';
} else if (language === 'python' && selectedText.includes('print(')) {
  instruction = 'Improve this debug print statement';
} else {
  instruction = `Fix this code: "${selectedText}"`;
}
```

This creates a much more intelligent and user-friendly editing experience! 🎉
