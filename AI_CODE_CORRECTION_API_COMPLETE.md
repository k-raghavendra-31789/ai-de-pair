# AI Code Correction API - Request & Response Format

## 📋 **Complete Request Format**

### **Endpoint:** `POST /api/ai/correct-code`

### **Request Body:**

```json
{
  "code": "col(\"1_quantity\"), col(\"1_suppkey\"), col(\"1_extendedprice\")",
  "fileName": "sample.py",
  "language": "python",
  "startLine": 8,
  "endLine": 8,
  "startColumn": 30,
  "endColumn": 85,
  "userInstructions": "Fix this code: \"col(\"1_quantity\"), col(\"1_suppkey\"), col(\"1_extendedprice\")\"",
  "correctionMode": "fix",
  "action": "custom",
  "fullFileContext": "# Complete file content here (only for enhance mode)",
  "timestamp": "2025-09-12T14:30:45.123Z",
  "sessionId": "correction_1726147845123_abc123def"
}
```

## 📝 **Field Descriptions**

### **Core Code Data:**

- **`code`** _(string)_: The actual selected text that needs correction
- **`fileName`** _(string)_: Name of the file being edited
- **`language`** _(string)_: Programming language (python, sql, javascript, etc.)

### **Selection Position:**

- **`startLine`** _(number)_: Starting line number (1-indexed)
- **`endLine`** _(number)_: Ending line number (1-indexed)
- **`startColumn`** _(number)_: Starting column position (1-indexed)
- **`endColumn`** _(number)_: Ending column position (1-indexed)

### **User Context:**

- **`userInstructions`** _(string)_: Auto-populated with selected code + any user edits
- **`correctionMode`** _(string)_: `"fix"` (surgical) or `"enhance"` (comprehensive)
- **`action`** _(string)_: `"custom"` (with instructions) or `"fix"`/`"enhance"`

### **AI Context (Optional):**

- **`fullFileContext`** _(string)_: Complete file content (only sent in "enhance" mode)

### **Metadata:**

- **`timestamp`** _(string)_: ISO timestamp of the request
- **`sessionId`** _(string)_: Unique identifier for tracking

---

## 🔄 **Expected Response Format**

### **Success Response:**

```json
{
  "status": "success",
  "correctedCode": "col(\"1_quantity\"),\ncol(\"1_suppkey\"),\ncol(\"1_extendedprice\")",
  "originalCode": "col(\"1_quantity\"), col(\"1_suppkey\"), col(\"1_extendedprice\")",
  "improvements": [
    "Added proper line breaks for readability",
    "Formatted for better code structure"
  ],
  "executionTime": "1.2s",
  "model": "gpt-4",
  "confidence": 0.95,
  "sessionId": "correction_1726147845123_abc123def"
}
```

### **Error Response:**

```json
{
  "status": "error",
  "message": "AI service temporarily unavailable",
  "errorCode": "AI_SERVICE_ERROR",
  "sessionId": "correction_1726147845123_abc123def",
  "retryAfter": 30
}
```

---

## 🎯 **Request Examples by Mode**

### **1. Quick Fix Mode:**

```json
{
  "code": "SELCT * form users",
  "correctionMode": "fix",
  "fullFileContext": "",
  "userInstructions": "Fix this code: \"SELCT * form users\""
}
```

**Expected Response:**

```json
{
  "status": "success",
  "correctedCode": "SELECT * FROM users;",
  "improvements": ["Fixed SELECT typo", "Fixed FROM typo", "Added semicolon"]
}
```

### **2. Smart Enhance Mode:**

```json
{
  "code": "SELECT * FROM users WHERE id = 1",
  "correctionMode": "enhance",
  "fullFileContext": "-- User management system\n-- Tables: users(id, name, email, status, created_at)\nSELECT * FROM users WHERE id = 1;",
  "userInstructions": "Fix this code: \"SELECT * FROM users WHERE id = 1\""
}
```

**Expected Response:**

```json
{
  "status": "success",
  "correctedCode": "SELECT \n    id,\n    name,\n    email,\n    status,\n    created_at\nFROM users \nWHERE id = 1 \n    AND status = 'active'\n    AND deleted_at IS NULL;",
  "improvements": [
    "Replaced SELECT * with specific columns",
    "Added proper formatting",
    "Added status and soft delete checks based on context"
  ]
}
```

### **3. Custom Instructions:**

```json
{
  "code": "print(user.name)",
  "userInstructions": "Convert this to use logging instead of print",
  "correctionMode": "fix"
}
```

**Expected Response:**

```json
{
  "status": "success",
  "correctedCode": "import logging\nlogger = logging.getLogger(__name__)\nlogger.info(f\"User name: {user.name}\")",
  "improvements": ["Replaced print with proper logging", "Added logger setup"]
}
```

---

## 🛠 **Backend Implementation Example**

### **FastAPI (Python):**

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import openai

class CodeCorrectionRequest(BaseModel):
    code: str
    fileName: str
    language: str
    startLine: int
    endLine: int
    startColumn: int
    endColumn: int
    userInstructions: str = ""
    correctionMode: str  # "fix" or "enhance"
    action: str
    fullFileContext: str = ""
    timestamp: str
    sessionId: str

@app.post("/api/ai/correct-code")
async def correct_code(request: CodeCorrectionRequest):
    try:
        # Build AI prompt based on mode
        if request.correctionMode == "fix":
            prompt = f"""
Fix only syntax errors, typos, and obvious bugs in this {request.language} code:

Code to fix: {request.code}

User instructions: {request.userInstructions}

Return only the corrected code without explanations.
"""
        else:  # enhance mode
            prompt = f"""
Improve this {request.language} code using the file context for optimization and best practices:

Code to improve: {request.code}
File context: {request.fullFileContext}
User instructions: {request.userInstructions}

Return only the improved code without explanations.
"""

        # Call OpenAI
        response = await openai.ChatCompletion.acreate(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are an expert code reviewer and optimizer."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1
        )

        corrected_code = response.choices[0].message.content.strip()

        return {
            "status": "success",
            "correctedCode": corrected_code,
            "originalCode": request.code,
            "sessionId": request.sessionId,
            "improvements": ["AI-generated improvements"],
            "executionTime": "1.2s",
            "model": "gpt-4",
            "confidence": 0.95
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "message": str(e),
                "sessionId": request.sessionId
            }
        )
```

### **Node.js/Express:**

```javascript
app.post('/api/ai/correct-code', async (req, res) => {
  try {
    const {
      code,
      language,
      userInstructions,
      correctionMode,
      fullFileContext,
      sessionId,
    } = req.body;

    // Build prompt
    const prompt =
      correctionMode === 'fix'
        ? `Fix syntax errors in this ${language} code: ${code}`
        : `Improve this ${language} code with context: ${fullFileContext}\nCode: ${code}`;

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    });

    res.json({
      status: 'success',
      correctedCode: completion.choices[0].message.content,
      originalCode: code,
      sessionId,
      executionTime: '1.2s',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      sessionId: req.body.sessionId,
    });
  }
});
```

---

## 🔒 **Security & Validation**

### **Input Validation:**

- ✅ Validate `language` against allowed languages
- ✅ Limit `code` length (max 10,000 chars)
- ✅ Sanitize `userInstructions` for prompt injection
- ✅ Validate line/column numbers are positive

### **Rate Limiting:**

- ✅ Implement per-user/IP rate limits
- ✅ Track requests by `sessionId`
- ✅ Monitor AI API usage and costs

This complete API format gives you everything needed to implement real AI code correction! 🚀
