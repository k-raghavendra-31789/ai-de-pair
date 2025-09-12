# Z-Index Layer Management

## 🎯 **Z-Index Hierarchy**

To prevent UI elements from hiding behind each other, here's the z-index hierarchy:

### **Layer Stack (Bottom to Top):**

```
┌─────────────────────────────────────────┐
│ z-[99999] - Code Correction Toolbar    │ ← Ultra-topmost (fixed)
├─────────────────────────────────────────┤
│ z-[9999] - Diff Preview Modal          │ ← Topmost (fixed)
├─────────────────────────────────────────┤
│ z-50 - FileExplorer Modals/Context     │ ← Standard modals
├─────────────────────────────────────────┤
│ z-40 - FileExplorer Backdrops          │
├─────────────────────────────────────────┤
│ z-30 - (Available for other components)│
├─────────────────────────────────────────┤
│ z-20 - (Available for other components)│
├─────────────────────────────────────────┤
│ z-10 - (Available for other components)│
├─────────────────────────────────────────┤
│ z-0  - Base editor and main content    │ ← Base layer
└─────────────────────────────────────────┘
```

## 🔧 **Current Implementation:**

### **MonacoEditor Components:**

- **Correction Toolbar:** `z-[99999]` + `fixed` - Ultra-topmost, positioned relative to viewport
- **Diff Preview Modal:** `z-[9999]` + `fixed` - Must be topmost for critical user decisions
- **Editor Container:** `z-0` - Base layer

### **FileExplorer Components:**

- **Modals (Create, Delete, etc.):** `z-50`
- **Context Menus:** `z-50`
- **Backdrop overlays:** `z-40`

## 🎯 **Why This Hierarchy:**

### **1. Diff Preview Modal (z-[9999]):**

- **Critical user decision** - must be visible
- **Blocks all interaction** until user decides
- **Contains important code changes** that need review

### **2. Correction Toolbar (z-[9998]):**

- **Active editing tool** - should float above everything
- **User initiated** - appears on text selection
- **Secondary to diff modal only**

### **3. FileExplorer Elements (z-50):**

- **Standard modal interactions**
- **File management operations**
- **Should not interfere with code editing**

## 🚀 **Best Practices:**

### **Adding New Components:**

1. **Check existing z-index values** in the component
2. **Use appropriate layer** for the component's importance
3. **Document the choice** for future reference

### **Z-Index Values to Use:**

```css
/* Ultra-critical modals (code diffs, confirmations) */
z-[9999]

/* Critical floating tools (active editing) */
z-[9998]

/* Standard modals and overlays */
z-50

/* Backdrop/overlay elements */
z-40

/* Elevated but not modal */
z-30

/* Standard floating elements */
z-20

/* Slightly elevated */
z-10

/* Base content */
z-0
```

### **Tailwind Z-Index Classes:**

```css
z-0     /* 0 */
z-10    /* 10 */
z-20    /* 20 */
z-30    /* 30 */
z-40    /* 40 */
z-50    /* 50 */
z-[60]  /* 60 - custom value */
z-[9998] /* 9998 - custom high value */
z-[9999] /* 9999 - maximum priority */
```

## 🐛 **Debugging Z-Index Issues:**

### **1. Use Browser DevTools:**

```javascript
// Console command to see all z-index values
Array.from(document.querySelectorAll('*'))
  .filter((el) => getComputedStyle(el).zIndex !== 'auto')
  .map((el) => ({
    element: el,
    zIndex: getComputedStyle(el).zIndex,
    position: getComputedStyle(el).position,
  }))
  .sort((a, b) => parseInt(b.zIndex) - parseInt(a.zIndex));
```

### **2. Visual Inspection:**

- Add temporary background colors to identify layers
- Use browser's 3D view if available
- Check `position` property (only positioned elements respect z-index)

### **3. Common Issues:**

- ❌ **Parent container** has lower z-index than child needs
- ❌ **Missing position** property (relative, absolute, fixed)
- ❌ **Transform/opacity** creates new stacking context
- ❌ **Multiple z-50** elements competing for same layer

## ✅ **Verification:**

After implementing the z-index fixes:

1. **Diff modal** should appear above file explorer ✅
2. **Correction toolbar** should float above all content ✅
3. **FileExplorer modals** should work normally ✅
4. **No z-index conflicts** between components ✅

The layering now ensures proper visual hierarchy! 🎉
