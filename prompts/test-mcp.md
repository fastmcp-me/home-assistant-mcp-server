Looking at the evaluation prompts for the Logz.io MCP server implementation, I can see several opportunities to make them more effective for LLMs to help fix the code without direct access to the source. Here's how I would improve the prompt to include more useful information while leveraging as many MCP server features as possible:

# Improved Logz.io MCP Server Evaluation Prompt

## Context and Objective

You are an expert evaluator conducting a thorough assessment of a Logz.io MCP server implementation. Your goal is to identify issues in the implementation and provide concrete, actionable recommendations for fixes that could be applied without seeing the actual source code.

## Evaluation Framework

Analyze the server based on:

1. API responses and error patterns observed in examples
2. Log output formats and information density
3. Query translation mechanisms and effectiveness
4. Response handling patterns and error messaging
5. Performance metrics visible in logs
6. Capability declarations and feature implementations

## Complete MCP Feature Coverage

For each MCP feature, evaluate implementation completeness:

### 1. Tools Functionality

- How well are MCP tool definitions structured?
- Do tools follow proper JSON schema validation?
- Are tool errors properly structured with `isError: true` and descriptive content?
- Is tool listing endpoint properly implemented?
- Evidence of tools/call implementation correctness

### 2. Resources Management

- Resource URIs structure and consistency
- Resource listing capabilities
- Resource read implementation
- Resource subscription support
- Resource change notification implementation
- URI templates handling

### 3. Prompts System

- Quality of prompt definitions and arguments
- Prompt template rendering
- Dynamic prompt content generation
- List prompts endpoint implementation
- Get prompt endpoint implementation
- Prompt list change notifications

### 4. Transport Layer Implementation

- Evidence of proper message framing
- Request/response correlation
- Error handling at transport layer
- Connection lifecycle management
- Message serialization/deserialization

### 5. Protocol Compliance

- Version negotiation handling
- Capability declaration
- Initialization sequence correctness
- Protocol-level error handling
- Type validation and schema enforcement

## Example Response Patterns

### Tool Call Example Success

```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Successfully processed query: service:order-processing AND level:ERROR"
      }
    ]
  }
}
```

### Tool Call Example Error

```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "result": {
    "isError": true,
    "content": [
      {
        "type": "text",
        "text": "Failed to parse query: Invalid syntax in 'service: order-processing AND'"
      }
    ]
  }
}
```

### Resource Read Example

```json
{
  "jsonrpc": "2.0",
  "id": 43,
  "result": {
    "contents": [
      {
        "uri": "logs://service/order-processing?timeRange=15m",
        "mimeType": "application/json",
        "text": "{\"hits\":[{\"_source\":{\"timestamp\":\"2023-01-02T15:30:42.123Z\",\"level\":\"ERROR\",\"message\":\"Connection refused\",\"service\":\"order-processing\"}}]}"
      }
    ]
  }
}
```

### Initialization Example

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-10-05",
    "name": "logzio-mcp",
    "version": "1.0.0",
    "capabilities": {
      "tools": {},
      "resources": {}
    }
  }
}
```

## Detailed Log Output Examples

```
2023-01-02 15:32:10.123 INFO [logzio-mcp] - Client connected: client-id-12345
2023-01-02 15:32:10.234 DEBUG [logzio-mcp] - Processing initialize request with protocol version 2024-10-05
2023-01-02 15:32:10.345 INFO [logzio-mcp] - Initializing with capabilities: tools=true, resources=true
2023-01-02 15:32:10.456 DEBUG [logzio-mcp] - Processing query "service:order-processing AND level:ERROR" with params {timeRange: "15m", size: 100}
2023-01-02 15:32:10.567 TRACE [logzio-mcp] - Query validated successfully
2023-01-02 15:32:10.678 DEBUG [logzio-mcp] - Query translated to Elasticsearch DSL: {"query":{"bool":{"must":[{"match":{"service":"order-processing"}},{"match":{"level":"ERROR"}}]}}}
2023-01-02 15:32:10.789 DEBUG [logzio-mcp] - Executing Elasticsearch query with indices: logzio-mcp-logs-2023.01.*
2023-01-02 15:32:11.890 DEBUG [logzio-mcp] - Processing response with 23 hits
2023-01-02 15:32:11.901 INFO [logzio-mcp] - Query completed in 1633ms, returned 23 results
```

## Common Error Patterns

```
2023-01-02 15:33:20.123 ERROR [logzio-mcp] - Query parsing error: Failed to parse query [service: order-processing AND]
2023-01-02 15:33:20.234 DEBUG [logzio-mcp] - Error details: SyntaxError: Expected field value after AND operator
2023-01-02 15:33:20.345 WARN [logzio-mcp] - Elasticsearch request timeout after 10000ms
2023-01-02 15:33:20.456 ERROR [logzio-mcp] - Failed to initialize resources: IndexNotFoundException [index_not_found_exception] missing index [logzio-mcp-logs-2023]
2023-01-02 15:33:20.567 ERROR [logzio-mcp] - Tool execution failed: QueryValidationError - Field 'nonexistent_field' is not recognized
```

## Expected Tool Implementations

The server should implement these essential tools:

1. `search-logs` - For searching logs with Elasticsearch DSL
2. `quick-search` - For simplified log searching with text queries
3. `get-fields` - For retrieving available fields from indices
4. `analyze-errors` - For finding patterns in error logs
5. `log-histogram` - For time-based log distribution
6. `log-dashboard` - For overview metrics
7. `build-query` - For constructing complex queries

## Expected Resource URIs

The server should expose these resource types:

1. `logs://service/{service-name}?timeRange={range}`
2. `logs://level/{level}?timeRange={range}`
3. `logs://query/{query-string}?timeRange={range}`
4. `indices://pattern/{index-pattern}`

## Expected Prompt Templates

The server should provide these prompt templates:

1. `analyze-logs` - For natural language log analysis
2. `debug-error` - For error debugging workflows
3. `identify-patterns` - For finding patterns in logs
4. `create-alert` - For alert rule generation
5. `optimize-query` - For query performance improvement

## Output Format

For each issue identified:

1. **ISSUE CODE**: Unique identifier (e.g., QUERY-VALIDATION-001)
2. **SEVERITY**: Critical, High, Medium, Low
3. **COMPONENT**: Specific component (e.g., QueryParser, ElasticsearchConnector)
4. **EVIDENCE**: Specific examples from logs/responses showing the issue
5. **PROBLEM**: Clear description of what's wrong
6. **ROOT CAUSE**: Most likely underlying cause without access to source
7. **FIX STRATEGY**: Concrete code-oriented fixes that could be applied
8. **CODE EXAMPLE**: Possible implementation in pseudocode or actual code

For feature recommendations:

1. **FEATURE ID**: Unique identifier (e.g., FEAT-HISTOGRAM-001)
2. **USER NEED**: Problem this solves for users
3. **IMPLEMENTATION APPROACH**: Technical implementation strategy
4. **IMPLEMENTATION EXAMPLE**: Sample code showing how to implement
5. **INTEGRATION POINTS**: How it connects with existing components
6. **PRIORITY**: High/Medium/Low with justification

## Additional Testing Context

When evaluating MCP capabilities, consider these test scenarios:

1. How does the server handle concurrent requests?
2. Is there evidence of memory management issues with large result sets?
3. How well does error propagation work through the transport layer?
4. Are there signs of improper initialization sequence?
5. Is the server correctly implementing subscription-based notifications?
6. Does the server validate all client inputs properly?
7. How does the server handle protocol version mismatches?

## Focus on providing practical, code-level recommendations that could be directly applied to improve the server without seeing the original source code.

# Logz.io MCP Server Evaluation Template

## Evaluation Overview

**Server Name:** [Server Name]
**Version:** [Version Number]
**Evaluation Date:** [YYYY-MM-DD]
**Evaluator:** [Evaluator Name]

---

## 1. Protocol Compliance Assessment

| Feature                 | Implementation Status                | Evidence | Issues | Recommendations |
| ----------------------- | ------------------------------------ | -------- | ------ | --------------- |
| Version negotiation     | ☐ Complete<br>☐ Partial<br>☐ Missing |          |        |                 |
| Capability declaration  | ☐ Complete<br>☐ Partial<br>☐ Missing |          |        |                 |
| Initialization sequence | ☐ Complete<br>☐ Partial<br>☐ Missing |          |        |                 |
| Protocol error handling | ☐ Complete<br>☐ Partial<br>☐ Missing |          |        |                 |
| Schema validation       | ☐ Complete<br>☐ Partial<br>☐ Missing |          |        |                 |

**Overall Protocol Compliance Score:** [1-10]

**Critical Findings:**

- [Finding 1]
- [Finding 2]

---

## 2. Tools Functionality Assessment

### 2.1 Core Tools Implementation

| Tool Name      | Implementation Status                | Response Time | Error Handling | Documentation Quality |
| -------------- | ------------------------------------ | ------------- | -------------- | --------------------- |
| search-logs    | ☐ Complete<br>☐ Partial<br>☐ Missing |               |                |                       |
| quick-search   | ☐ Complete<br>☐ Partial<br>☐ Missing |               |                |                       |
| get-fields     | ☐ Complete<br>☐ Partial<br>☐ Missing |               |                |                       |
| analyze-errors | ☐ Complete<br>☐ Partial<br>☐ Missing |               |                |                       |
| log-histogram  | ☐ Complete<br>☐ Partial<br>☐ Missing |               |                |                       |
| log-dashboard  | ☐ Complete<br>☐ Partial<br>☐ Missing |               |                |                       |
| build-query    | ☐ Complete<br>☐ Partial<br>☐ Missing |               |                |                       |

### 2.2 Tool Framework Assessment

| Aspect                | Rating                         | Issues | Evidence | Recommendations |
| --------------------- | ------------------------------ | ------ | -------- | --------------- |
| Schema validation     | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |
| Error structure       | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |
| Parameter handling    | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |
| Tool listing endpoint | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |
| Documentation         | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |

**Overall Tools Functionality Score:** [1-10]

**Critical Issues:**

- [Issue 1]
- [Issue 2]

**Recommended Tool Improvements:**

1. [Improvement 1]
2. [Improvement 2]

---

## 3. Resources Management Assessment

### 3.1 Resource URI Implementation

| Resource URI                      | Implementation Status                | Response Time | Content Quality | Update Notifications |
| --------------------------------- | ------------------------------------ | ------------- | --------------- | -------------------- |
| logs://service/{service-name}     | ☐ Complete<br>☐ Partial<br>☐ Missing |               |                 |                      |
| logs://level/{level}              | ☐ Complete<br>☐ Partial<br>☐ Missing |               |                 |                      |
| logs://query/{query-string}       | ☐ Complete<br>☐ Partial<br>☐ Missing |               |                 |                      |
| indices://pattern/{index-pattern} | ☐ Complete<br>☐ Partial<br>☐ Missing |               |                 |                      |

### 3.2 Resource Framework Assessment

| Aspect                    | Rating                         | Issues | Evidence | Recommendations |
| ------------------------- | ------------------------------ | ------ | -------- | --------------- |
| URI structure consistency | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |
| Resource listing          | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |
| Read implementation       | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |
| Subscription support      | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |
| Change notifications      | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |
| URI template handling     | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |

**Overall Resources Management Score:** [1-10]

**Critical Issues:**

- [Issue 1]
- [Issue 2]

**Recommended Resource Improvements:**

1. [Improvement 1]
2. [Improvement 2]

---

## 4. Prompts System Assessment

### 4.1 Prompt Templates Implementation

| Prompt Template   | Implementation Status                | Rendering Quality | Argument Handling | Documentation |
| ----------------- | ------------------------------------ | ----------------- | ----------------- | ------------- |
| analyze-logs      | ☐ Complete<br>☐ Partial<br>☐ Missing |                   |                   |               |
| debug-error       | ☐ Complete<br>☐ Partial<br>☐ Missing |                   |                   |               |
| identify-patterns | ☐ Complete<br>☐ Partial<br>☐ Missing |                   |                   |               |
| create-alert      | ☐ Complete<br>☐ Partial<br>☐ Missing |                   |                   |               |
| optimize-query    | ☐ Complete<br>☐ Partial<br>☐ Missing |                   |                   |               |

### 4.2 Prompts Framework Assessment

| Aspect               | Rating                         | Issues | Evidence | Recommendations |
| -------------------- | ------------------------------ | ------ | -------- | --------------- |
| Definition quality   | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |
| Template rendering   | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |
| Dynamic content      | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |
| List endpoint        | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |
| Get endpoint         | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |
| Change notifications | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |

**Overall Prompts System Score:** [1-10]

**Critical Issues:**

- [Issue 1]
- [Issue 2]

**Recommended Prompt Improvements:**

1. [Improvement 1]
2. [Improvement 2]

---

## 5. Transport Layer Assessment

| Aspect                        | Rating                         | Issues | Evidence | Recommendations |
| ----------------------------- | ------------------------------ | ------ | -------- | --------------- |
| Message framing               | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |
| Request/response correlation  | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |
| Error handling                | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |
| Connection lifecycle          | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |
| Serialization/deserialization | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |
| Concurrency handling          | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |

**Overall Transport Layer Score:** [1-10]

**Critical Issues:**

- [Issue 1]
- [Issue 2]

**Recommended Transport Improvements:**

1. [Improvement 1]
2. [Improvement 2]

---

## 6. Performance Analysis

| Metric                      | Measurement | Benchmark | Analysis | Recommendations |
| --------------------------- | ----------- | --------- | -------- | --------------- |
| Average response time       |             |           |          |                 |
| Peak response time          |             |           |          |                 |
| Concurrent request handling |             |           |          |                 |
| Memory usage                |             |           |          |                 |
| CPU utilization             |             |           |          |                 |
| Error rate                  |             |           |          |                 |

**Performance Issues:**

- [Issue 1]
- [Issue 2]

**Performance Improvement Recommendations:**

1. [Recommendation 1]
2. [Recommendation 2]

---

## 7. Error Handling Analysis

### 7.1 Common Error Patterns Observed

| Error Pattern     | Frequency | Component | Root Cause | Recommendation |
| ----------------- | --------- | --------- | ---------- | -------------- |
| [Error Pattern 1] |           |           |            |                |
| [Error Pattern 2] |           |           |            |                |
| [Error Pattern 3] |           |           |            |                |

### 7.2 Error Handling Quality Assessment

| Aspect                | Rating                         | Issues | Evidence | Recommendations |
| --------------------- | ------------------------------ | ------ | -------- | --------------- |
| Error clarity         | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |
| Error structure       | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |
| Root cause visibility | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |
| Recovery mechanisms   | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |
| Error propagation     | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |

**Overall Error Handling Score:** [1-10]

---

## 8. Detailed Issue Reports

### Issue 1: [ISSUE-CODE-001]

**Severity:** [Critical/High/Medium/Low]
**Component:** [Component Name]
**Evidence:**

```
[Include relevant log snippet or response showing the issue]
```

**Problem:**
[Clear description of what's wrong]

**Root Cause:**
[Most likely underlying cause without access to source]

**Fix Strategy:**
[Concrete code-oriented fixes that could be applied]

**Code Example:**

```javascript
// Possible implementation example
function improvedQueryParser(query) {
  // Implementation details
}
```

### Issue 2: [ISSUE-CODE-002]

[Repeat structure for each issue]

---

## 9. Feature Recommendations

### Feature 1: [FEAT-ID-001]

**User Need:**
[Problem this solves for users]

**Implementation Approach:**
[Technical implementation strategy]

**Implementation Example:**

```javascript
// Sample code showing how to implement
function newFeatureImplementation() {
  // Implementation details
}
```

**Integration Points:**
[How it connects with existing components]

**Priority:**
[High/Medium/Low with justification]

### Feature 2: [FEAT-ID-002]

[Repeat structure for each feature recommendation]

---

## 10. Security Assessment

| Security Aspect              | Rating                         | Issues | Evidence | Recommendations |
| ---------------------------- | ------------------------------ | ------ | -------- | --------------- |
| Input validation             | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |
| Authentication               | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |
| Authorization                | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |
| Data protection              | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |
| Rate limiting                | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |
| Error information disclosure | ☐ Good<br>☐ Adequate<br>☐ Poor |        |          |                 |

**Overall Security Score:** [1-10]

**Critical Security Issues:**

- [Issue 1]
- [Issue 2]

---

## 11. Testing Scenario Results

| Test Scenario              | Result                        | Issues | Recommendations |
| -------------------------- | ----------------------------- | ------ | --------------- |
| Concurrent requests        | ☐ Pass<br>☐ Partial<br>☐ Fail |        |                 |
| Large result sets          | ☐ Pass<br>☐ Partial<br>☐ Fail |        |                 |
| Error propagation          | ☐ Pass<br>☐ Partial<br>☐ Fail |        |                 |
| Initialization sequence    | ☐ Pass<br>☐ Partial<br>☐ Fail |        |                 |
| Subscription notifications | ☐ Pass<br>☐ Partial<br>☐ Fail |        |                 |
| Input validation           | ☐ Pass<br>☐ Partial<br>☐ Fail |        |                 |
| Protocol version mismatch  | ☐ Pass<br>☐ Partial<br>☐ Fail |        |                 |

---

## 12. Overall Assessment

### 12.1 Component Scores

| Component            | Score (1-10) | Priority Issues |
| -------------------- | ------------ | --------------- |
| Protocol Compliance  |              |                 |
| Tools Functionality  |              |                 |
| Resources Management |              |                 |
| Prompts System       |              |                 |
| Transport Layer      |              |                 |
| Performance          |              |                 |
| Error Handling       |              |                 |
| Security             |              |                 |

**Overall Implementation Score:** [1-10]

### 12.2 Summary of Critical Issues

1. [Critical Issue 1]
2. [Critical Issue 2]
3. [Critical Issue 3]

### 12.3 Top 5 Recommended Improvements

1. [Priority Improvement 1]
2. [Priority Improvement 2]
3. [Priority Improvement 3]
4. [Priority Improvement 4]
5. [Priority Improvement 5]

---

## 13. Appendix

### A. Test Environment

**Hardware:**

- [Hardware specifications]

**Software:**

- [Software versions]

**Testing Tools:**

- [Tools used]

### B. Test Request Examples

**Tool Call Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "method": "tools/call",
  "params": {
    "name": "search-logs",
    "arguments": {
      "query": "service:order-processing AND level:ERROR",
      "timeRange": "15m"
    }
  }
}
```

**Resource Read Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 43,
  "method": "resources/read",
  "params": {
    "uri": "logs://service/order-processing?timeRange=15m"
  }
}
```

### C. Glossary

- **MCP**: Managed Code Platform
- **DSL**: Domain Specific Language
- [Additional terms and definitions]
