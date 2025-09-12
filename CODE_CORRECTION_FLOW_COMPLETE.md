# Code Correction & Diff Preview Flow

## 🔄 **Complete Flow: Request → Response → Diff → Apply**

### **1. User Triggers Correction**

```
User selects code → Floating toolbar appears → User adds instructions → Ctrl+Enter or Apply
```

### **2. Request to Backend**

```javascript
// Request Format
{
  "code": "SELCT * form users whre id = 1",
  "fileName": "queries.sql",
  "language": "sql",
  "userInstructions": "Make this more efficient",
  "correctionMode": "fix", // or "enhance"
  "fullFileContext": "...", // Only for enhance mode
  "startLine": 5,
  "endLine": 5,
  // ... other metadata
}
```

### **3. Backend Response**

```javascript
// Response Format
{
  "status": "success",
  "correctedCode": "SELECT id, name, email FROM users WHERE id = 1 LIMIT 1;",
  "originalCode": "SELCT * form users whre id = 1",
  "improvements": ["Fixed typos", "Added specific columns", "Added LIMIT"],
  "executionTime": "1.2s"
}
```

### **4. Diff Preview Modal**

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Code Suggestion                      │
├─────────────────────────────────────────────────────────────┤
│ Original Code              │ AI Suggestion                  │
│ ┌─────────────────────────┐│ ┌─────────────────────────────┐ │
│ │ SELCT * form users      ││ │ SELECT id, name, email      │ │
│ │ whre id = 1             ││ │ FROM users                  │ │
│ │                         ││ │ WHERE id = 1 LIMIT 1;       │ │
│ └─────────────────────────┘│ └─────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                           [Reject] [Apply Changes]         │
└─────────────────────────────────────────────────────────────┘
```

### **5. User Decision**

- **Reject:** Close modal, keep original code
- **Apply:** Replace selected code with AI suggestion

---

## 🎯 **Current Implementation Status**

### **✅ What's Working:**

- ✅ Floating toolbar with Fix/Enhance modes
- ✅ Custom instructions input
- ✅ Request format prepared correctly
- ✅ Diff preview modal (just added!)
- ✅ Apply/Reject functionality

### **🔄 What's Simulated:**

- 🔄 AI Backend call (currently `simulateAICorrection()`)
- 🔄 Real AI processing (just regex replacements)

### **🚀 What Needs Real Implementation:**

```javascript
// Replace this simulation:
const response = await simulateAICorrection(correctionRequest);

// With real API call:
const response = await fetch('/api/ai/correct-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(correctionRequest),
});
const result = await response.json();
```

---

## 🛠 **Backend Integration Example**

### **FastAPI Endpoint:**

```python
@app.post("/api/ai/correct-code")
async def correct_code(request: CodeCorrectionRequest):
    # Call OpenAI/Claude/etc
    prompt = build_prompt(request)
    ai_response = await openai.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}]
    )

    return {
        "status": "success",
        "correctedCode": ai_response.choices[0].message.content,
        "originalCode": request.code,
        "improvements": extract_improvements(ai_response),
        "executionTime": "1.2s"
    }
```

### **Node.js/Express Endpoint:**

```javascript
app.post('/api/ai/correct-code', async (req, res) => {
  const { code, userInstructions, correctionMode } = req.body;

  // Build AI prompt
  const prompt = buildPrompt(code, userInstructions, correctionMode);

  // Call OpenAI
  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
  });

  res.json({
    status: 'success',
    correctedCode: completion.choices[0].message.content,
    originalCode: code,
  });
});
```

---

## 🎨 **User Experience Flow**

1. **User selects problematic code:** `SELCT * form users`
2. **Toolbar appears:** Fix/Enhance toggle buttons
3. **User adds instruction:** "Make this more efficient"
4. **User hits Apply:** Shows loading state
5. **Diff modal appears:** Side-by-side comparison
6. **User reviews changes:** Original vs AI suggestion
7. **User decides:** Reject (keep original) or Apply (use AI version)
8. **Code gets replaced:** Selected text updated in editor
9. **Focus returns:** Back to Monaco Editor

This provides a **safe, reviewable** way to apply AI suggestions with full user control! 🎉

---

## 🔧 **Advanced Features to Add**

### **1. Syntax Highlighting in Diff**

```javascript
// Use Monaco's syntax highlighting in diff preview
const highlightCode = (code, language) => {
  return monaco.editor.colorize(code, language, {});
};
```

### **2. Line-by-Line Diff**

```javascript
// Show detailed line changes
const generateLineDiff = (original, corrected) => {
  // Use a diff library like 'diff' npm package
  return Diff.diffLines(original, corrected);
};
```

### **3. Multiple Suggestions**

```javascript
// AI returns multiple options
{
  "suggestions": [
    { "code": "...", "description": "Quick fix" },
    { "code": "...", "description": "Optimized version" },
    { "code": "...", "description": "With error handling" }
  ]
}
```

### **4. Undo/Redo Integration**

```javascript
// Proper undo stack integration
editor.pushUndoStop();
editor.executeEdits('ai-correction', edits);
editor.pushUndoStop();
```

The flow is now complete with proper diff preview and user control! 🚀
