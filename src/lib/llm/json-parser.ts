/**
 * Robust JSON Parsing Utilities
 * Extract and parse JSON from LLM outputs safely
 */

/**
 * Clamp text to maximum length
 */
export function clampText(text: string, maxLength: number = 20000): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '…[truncated]';
}

/**
 * Extract JSON from LLM output using multiple strategies
 * Returns the JSON string or null if not found
 */
export function extractJsonString(raw: string): string | null {
  const trimmed = raw.trim();
  
  // Strategy 1: Prefer fenced code block with json
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch && fencedMatch[1]) {
    return fencedMatch[1].trim();
  }
  
  // Strategy 2: Scan for first JSON object by bracket matching
  const objStart = trimmed.indexOf('{');
  if (objStart !== -1) {
    const objEnd = findMatchingBracket(trimmed, objStart, '{', '}');
    if (objEnd !== -1) {
      return trimmed.slice(objStart, objEnd + 1);
    }
  }
  
  // Strategy 3: Scan for first JSON array
  const arrStart = trimmed.indexOf('[');
  if (arrStart !== -1) {
    const arrEnd = findMatchingBracket(trimmed, arrStart, '[', ']');
    if (arrEnd !== -1) {
      return trimmed.slice(arrStart, arrEnd + 1);
    }
  }
  
  return null;
}

/**
 * Find matching closing bracket
 */
function findMatchingBracket(
  text: string,
  startIndex: number,
  open: string,
  close: string
): number {
  let depth = 0;
  let inString = false;
  let escape = false;
  
  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];
    
    // Handle string literals
    if (char === '"' && !escape) {
      inString = !inString;
    }
    
    // Skip if inside string
    if (inString) {
      escape = char === '\\' && !escape;
      continue;
    }
    
    escape = false;
    
    // Track bracket depth
    if (char === open) {
      depth++;
    } else if (char === close) {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  
  return -1; // Not found
}

/**
 * Attempt to fix common JSON issues
 * IMPORTANT: Only safe transformations, never modify quotes globally
 */
export function tryFixJson(jsonStr: string): string {
  let fixed = jsonStr.trim();
  
  // 1. Remove trailing commas before } or ] (safe)
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
  
  // 2. Remove markdown artifacts from edges (safe)
  fixed = fixed.replace(/^[\s`"']*/, '').replace(/[\s`"']*$/, '');
  
  // 3. Remove ```json or ``` wrappers if still present (safe)
  fixed = fixed.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  
  // DO NOT:
  // - Replace quotes globally (breaks string content)
  // - Add quotes around keys (might break valid JSON)
  // - Any transformation that could corrupt data
  
  return fixed;
}

/**
 * Safe JSON parse with multiple fallback strategies
 */
export function safeJsonParse<T>(
  raw: string,
  fallback: T
): { success: true; data: T } | { success: false; data: T; error: string } {
  // Try 1: Direct parse
  try {
    const data = JSON.parse(raw);
    return { success: true, data: data as T };
  } catch {
    // Continue to next strategy
  }
  
  // Try 2: Extract JSON string first
  const extracted = extractJsonString(raw);
  if (extracted) {
    try {
      const data = JSON.parse(extracted);
      return { success: true, data: data as T };
    } catch {
      // Continue to next strategy
    }
    
    // Try 3: Fix and parse
    const fixed = tryFixJson(extracted);
    try {
      const data = JSON.parse(fixed);
      return { success: true, data: data as T };
    } catch {
      // Continue to next strategy
    }
  }
  
  // All strategies failed - return fallback
  return {
    success: false,
    data: fallback,
    error: 'Failed to parse JSON output from LLM',
  };
}

/**
 * Sanitize object to prevent prototype pollution
 * Only allows plain objects and safe values
 */
export function sanitizeObject<T>(obj: unknown): T {
  if (obj === null || obj === undefined) {
    return obj as T;
  }
  
  if (typeof obj !== 'object') {
    return obj as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item)) as T;
  }
  
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Skip dangerous keys
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    
    result[key] = sanitizeObject(value);
  }
  
  return result as T;
}

/**
 * Redact sensitive information from text
 */
export function redactSensitiveInfo(text: string): string {
  let redacted = text;
  
  // Redact API keys (common patterns)
  redacted = redacted.replace(/sk-[a-zA-Z0-9]{20,}/g, 'sk-***REDACTED***');
  redacted = redacted.replace(/Bearer\s+[a-zA-Z0-9\-_.]+/g, 'Bearer ***REDACTED***');
  
  // Redact passwords in URLs
  redacted = redacted.replace(/:\/\/[^:]+:[^@]+@/g, '://***:***@');
  
  // Redact email addresses (optional, comment out if needed)
  // redacted = redacted.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '***@***.***');
  
  return redacted;
}

/**
 * Truncate and sanitize for logging
 */
export function prepareForLogging(data: unknown, maxLength: number = 5000): string {
  let str: string;
  
  if (typeof data === 'string') {
    str = data;
  } else {
    str = JSON.stringify(data, null, 2);
  }
  
  str = redactSensitiveInfo(str);
  str = clampText(str, maxLength);
  
  return str;
}
