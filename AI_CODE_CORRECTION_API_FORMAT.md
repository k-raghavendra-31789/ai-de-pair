# AI Code Correction API Request Format

## Overview

This document describes the request format sent to the AI backend when users request code corrections through the inline code correction feature.

## 📋 Complete Request Format

```json
{
  "code": "SELECT * from users where id = 1",
  "fileName": "user_queries.sql",
  "language": "sql",
  "startLine": 5,
  "endLine": 5,
  "startColumn": 1,
  "endColumn": 33,
  "userInstructions": "Make this query more efficient and add proper formatting",
  "action": "custom",
  "fullFileContext": "-- User management queries\n\nSELECT * from users where id = 1;\n\nSELECT name, email FROM users WHERE active = true;",
  "timestamp": "2025-09-12T10:30:45.123Z",
  "sessionId": "correction_1726140645123_abc123def"
}
```

## 🔧 Field Descriptions

### **Core Selection Data**

```javascript
{
  "code": string,           // The actual selected code text
  "startLine": number,      // Starting line number (1-indexed)
  "endLine": number,        // Ending line number (1-indexed)
  "startColumn": number,    // Starting column position (1-indexed)
  "endColumn": number       // Ending column position (1-indexed)
}
```

### **File Context**

```javascript
{
  "fileName": string,       // Name of the file being edited
  "language": string,       // Programming language (sql, python, javascript, etc.)
  "fullFileContext": string // Complete file content for context
}
```

### **User Instructions**

```javascript
{
  "userInstructions": string, // Custom user instructions (optional)
  "action": string           // "custom" if instructions provided, "fix_and_improve" if not
}
```

### **Metadata**

```javascript
{
  "timestamp": string,       // ISO timestamp of the request
  "sessionId": string       // Unique session identifier
}
```

## 🎯 Example Requests by Use Case

### **1. Basic Fix (No User Instructions)**

```json
{
  "code": "select * from users",
  "fileName": "queries.sql",
  "language": "sql",
  "startLine": 1,
  "endLine": 1,
  "startColumn": 1,
  "endColumn": 19,
  "userInstructions": "",
  "action": "fix_and_improve",
  "fullFileContext": "select * from users;",
  "timestamp": "2025-09-12T10:30:45.123Z",
  "sessionId": "correction_1726140645123_abc123"
}
```

### **2. Custom Instructions**

```json
{
  "code": "def calculate_total(items):\n    total = 0\n    for item in items:\n        total += item.price\n    return total",
  "fileName": "calculator.py",
  "language": "python",
  "startLine": 15,
  "endLine": 19,
  "startColumn": 1,
  "endColumn": 17,
  "userInstructions": "Optimize this function for better performance and add error handling",
  "action": "custom",
  "fullFileContext": "class ShoppingCart:\n    def __init__(self):\n        self.items = []\n    \n    def add_item(self, item):\n        self.items.append(item)\n    \n    def calculate_total(items):\n        total = 0\n        for item in items:\n            total += item.price\n        return total",
  "timestamp": "2025-09-12T10:30:45.123Z",
  "sessionId": "correction_1726140645123_def456"
}
```

### **3. Multi-line SQL Block**

```json
{
  "code": "SELECT u.name, u.email, p.title\nFROM users u\nJOIN posts p ON u.id = p.user_id\nWHERE u.active = 1\nORDER BY u.name",
  "fileName": "user_posts.sql",
  "language": "sql",
  "startLine": 10,
  "endLine": 14,
  "startColumn": 1,
  "endColumn": 18,
  "userInstructions": "Add proper indexing hints and optimize for large datasets",
  "action": "custom",
  "fullFileContext": "-- User and Posts Analysis\n\n-- Get active users\nSELECT * FROM users WHERE active = 1;\n\n-- Get user posts\nSELECT u.name, u.email, p.title\nFROM users u\nJOIN posts p ON u.id = p.user_id\nWHERE u.active = 1\nORDER BY u.name;\n\n-- Count posts per user\nSELECT u.name, COUNT(p.id) as post_count\nFROM users u\nLEFT JOIN posts p ON u.id = p.user_id\nGROUp BY u.id, u.name;",
  "timestamp": "2025-09-12T10:30:45.123Z",
  "sessionId": "correction_1726140645123_ghi789"
}
```

## 🚀 Backend Implementation Example

### **FastAPI Endpoint**

````python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import openai

app = FastAPI()

class CodeCorrectionRequest(BaseModel):
    code: str
    fileName: str
    language: str
    startLine: int
    endLine: int
    startColumn: int
    endColumn: int
    userInstructions: Optional[str] = ""
    action: str
    fullFileContext: str
    timestamp: str
    sessionId: str

@app.post("/api/v1/code/correct")
async def correct_code(request: CodeCorrectionRequest):
    try:
        # Prepare AI prompt
        if request.userInstructions:
            prompt = f"""
You are a code improvement assistant. The user has selected the following {request.language} code:

```{request.language}
{request.code}
````

User's specific instructions: {request.userInstructions}

File context for reference:

```{request.language}
{request.fullFileContext}
```

Please provide the improved code following the user's instructions.
"""
else:
prompt = f"""
You are a code improvement assistant. Please fix, optimize and improve the following {request.language} code:

```{request.language}
{request.code}
```

File context for reference:

```{request.language}
{request.fullFileContext}
```

Focus on:

- Bug fixes
- Performance optimization
- Code readability
- Best practices
- Proper formatting
  """

          # Call AI API (OpenAI example)
          response = await openai.ChatCompletion.acreate(
              model="gpt-4",
              messages=[
                  {"role": "system", "content": "You are an expert code reviewer and optimizer."},
                  {"role": "user", "content": prompt}
              ],
              temperature=0.1
          )

          corrected_code = response.choices[0].message.content

          return {
              "status": "success",
              "correctedCode": corrected_code,
              "originalCode": request.code,
              "sessionId": request.sessionId,
              "improvements": ["Formatting", "Optimization", "Best practices"],
              "executionTime": "1.2s"
          }

      except Exception as e:
          raise HTTPException(status_code=500, detail=str(e))

````

### **Node.js/Express Example**
```javascript
const express = require('express');
const { OpenAI } = require('openai');
const app = express();

app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post('/api/v1/code/correct', async (req, res) => {
  try {
    const {
      code,
      fileName,
      language,
      startLine,
      endLine,
      startColumn,
      endColumn,
      userInstructions,
      action,
      fullFileContext,
      timestamp,
      sessionId
    } = req.body;

    // Build AI prompt
    const prompt = userInstructions
      ? `User instructions: ${userInstructions}\n\nCode to improve:\n${code}`
      : `Please fix and improve this ${language} code:\n${code}`;

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are an expert code reviewer." },
        { role: "user", content: prompt }
      ],
      temperature: 0.1
    });

    const correctedCode = completion.choices[0].message.content;

    res.json({
      status: 'success',
      correctedCode,
      originalCode: code,
      sessionId,
      metadata: {
        fileName,
        language,
        lineRange: `${startLine}-${endLine}`,
        hasUserInstructions: !!userInstructions
      }
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      sessionId: req.body.sessionId
    });
  }
});
````

## 📊 Response Format

### **Success Response**

```json
{
  "status": "success",
  "correctedCode": "-- Optimized query with proper formatting\nSELECT *\nFROM users\nWHERE id = 1;",
  "originalCode": "select * from users where id = 1",
  "sessionId": "correction_1726140645123_abc123",
  "improvements": ["Formatting", "Query optimization", "Best practices"],
  "executionTime": "1.2s",
  "metadata": {
    "model": "gpt-4",
    "tokensUsed": 150,
    "confidence": 0.95
  }
}
```

### **Error Response**

```json
{
  "status": "error",
  "message": "AI service temporarily unavailable",
  "sessionId": "correction_1726140645123_abc123",
  "errorCode": "AI_SERVICE_ERROR",
  "retryAfter": 30
}
```

## 🔒 Security Considerations

### **Input Validation**

- Validate `language` against allowed languages
- Limit `code` length (e.g., max 10,000 characters)
- Sanitize `userInstructions` to prevent prompt injection
- Validate line numbers are positive integers

### **Rate Limiting**

- Implement per-user rate limiting
- Track requests by `sessionId`
- Limit concurrent requests per user

### **Data Privacy**

- Log requests without sensitive code content
- Implement code anonymization if needed
- Respect user privacy settings

This comprehensive request format allows for flexible AI-powered code corrections while maintaining context and user intent.
