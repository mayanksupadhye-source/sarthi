import mongoose from "mongoose";

/**
 * Sanitizes object keys to prevent MongoDB operator injection ($gt, $ne, $where)
 * and property path traversal (containing '.').
 */
export function sanitizeMongoInput(obj) {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeMongoInput);
  }

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    // Drop keys starting with $ (MongoDB operator injection) or containing .
    if (key.startsWith("$") || key.includes(".")) {
      continue;
    }

    if (value && typeof value === "object") {
      clean[key] = sanitizeMongoInput(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Express middleware that sanitizes req.body, req.query, and req.params.
 */
export function sanitizeRequest(req, res, next) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeMongoInput(req.body);
  }
  if (req.query && typeof req.query === "object") {
    // Express 5 exposes req.query through a getter, so assignment throws in
    // strict mode. Shadow it on this request with the sanitized parsed values.
    Object.defineProperty(req, "query", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: sanitizeMongoInput(req.query),
    });
  }
  if (req.params && typeof req.params === "object") {
    req.params = sanitizeMongoInput(req.params);
  }
  next();
}

/**
 * Middleware that validates route params like :id, :taskId, :subjectId are valid MongoDB ObjectIds.
 */
export function validateObjectIdParams(req, res, next) {
  for (const [paramName, paramVal] of Object.entries(req.params)) {
    if (paramName === "id" || paramName.toLowerCase().endsWith("id")) {
      // Allow known non-ObjectId slugs (e.g. 'dsa', 'web-dev', 'weekday')
      if (["dayType", "slug", "weekNumber", "page"].includes(paramName)) {
        continue;
      }
      if (paramVal && !mongoose.isValidObjectId(paramVal)) {
        return res.status(400).json({
          success: false,
          error: `Invalid identifier format for parameter '${paramName}'. Must be a valid 24-character hexadecimal ID.`,
        });
      }
    }
  }
  next();
}

/**
 * Sanitizes spreadsheet cell strings to prevent CSV formula injection (=, +, -, @)
 * while preserving legitimate negative numbers (e.g., -5, -12.5).
 */
export function sanitizeCsvValue(val) {
  if (val === null || val === undefined) return "";
  const str = String(val).trim();
  if (!str) return "";

  // If it's a valid numeric value (e.g. -15 or -3.14), preserve as number
  if (/^[-+]?\d+(\.\d+)?$/.test(str)) {
    return str;
  }

  // If leading character is dangerous spreadsheet formula trigger (=, +, -, @, \t, \r)
  const dangerousPrefixes = ["=", "+", "-", "@", "\t", "\r"];
  if (dangerousPrefixes.includes(str[0])) {
    return `'${str}`; // Prepend apostrophe to neutralize formula execution in Excel/Sheets
  }

  return str;
}
