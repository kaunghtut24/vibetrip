/**
 * Request Validation Middleware
 * 
 * Validates incoming requests to prevent malformed data and security issues
 */

/**
 * Validate Gemini generate request
 */
export function validateGeminiRequest(req, res, next) {
  const { model, contents, config } = req.body || {};
  
  // Check required fields
  if (!model || typeof model !== 'string') {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'model is required and must be a string'
    });
  }
  
  if (!contents) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'contents is required'
    });
  }
  
  // Validate model name
  const validModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  if (!validModels.includes(model)) {
    return res.status(400).json({
      error: 'Validation Error',
      message: `Invalid model. Must be one of: ${validModels.join(', ')}`
    });
  }
  
  // Validate contents length (prevent abuse)
  const contentsStr = typeof contents === 'string' ? contents : JSON.stringify(contents);
  if (contentsStr.length > 50000) { // 50KB limit
    return res.status(400).json({
      error: 'Validation Error',
      message: 'contents exceeds maximum length of 50KB'
    });
  }
  
  // Validate config if present
  if (config && typeof config !== 'object') {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'config must be an object'
    });
  }
  
  next();
}

/**
 * Sanitize user input to prevent injection attacks
 */
export function sanitizeInput(req, res, next) {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  next();
}

function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    // Remove potentially dangerous keys
    if (key.startsWith('__') || key.startsWith('$')) {
      continue;
    }
    
    if (typeof value === 'string') {
      // Remove null bytes and control characters
      sanitized[key] = value.replace(/\0/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Validate request size
 */
export function validateRequestSize(maxSizeBytes = 1024 * 1024) { // Default 1MB
  return (req, res, next) => {
    const contentLength = req.headers['content-length'];
    
    if (contentLength && parseInt(contentLength) > maxSizeBytes) {
      return res.status(413).json({
        error: 'Payload Too Large',
        message: `Request body exceeds maximum size of ${maxSizeBytes / 1024}KB`
      });
    }
    
    next();
  };
}

/**
 * Validate content type
 */
export function validateContentType(allowedTypes = ['application/json']) {
  return (req, res, next) => {
    // Skip for GET requests
    if (req.method === 'GET' || req.method === 'HEAD') {
      return next();
    }
    
    const contentType = req.headers['content-type'];
    
    if (!contentType) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Content-Type header is required'
      });
    }
    
    const isAllowed = allowedTypes.some(type => contentType.includes(type));
    
    if (!isAllowed) {
      return res.status(415).json({
        error: 'Unsupported Media Type',
        message: `Content-Type must be one of: ${allowedTypes.join(', ')}`
      });
    }
    
    next();
  };
}

/**
 * Validate admin requests (simple token-based auth)
 */
export function validateAdminRequest(req, res, next) {
  const adminToken = process.env.ADMIN_TOKEN || 'change-me-in-production';
  const providedToken = req.headers['x-admin-token'];
  
  if (!providedToken || providedToken !== adminToken) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid or missing admin token'
    });
  }
  
  next();
}

