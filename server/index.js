import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { globalRateLimiter, geminiRateLimiter, createRateLimitMiddleware } from './rateLimiter.js';
import { validateGeminiRequest, sanitizeInput, validateRequestSize, validateContentType, validateAdminRequest } from './validation.js';

// Load environment variables from .env (GEMINI_API_KEY is required)
dotenv.config();

const PORT = process.env.PORT || 5000;
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('[Gemini Backend] Missing GEMINI_API_KEY in environment.');
  process.exit(1);
}

console.log('[Gemini Backend] Initializing GoogleGenAI client...');
const client = new GoogleGenAI({ apiKey });
console.log('[Gemini Backend] Client initialized successfully');

const app = express();

// Disable keep-alive to prevent connection issues
app.use((req, res, next) => {
  res.setHeader('Connection', 'close');
  next();
});

app.use(cors());
app.use(express.json());

// Apply request validation
app.use(validateRequestSize(2 * 1024 * 1024)); // 2MB max
app.use(validateContentType(['application/json']));
app.use(sanitizeInput);

// Apply global rate limiting to all routes
app.use(createRateLimitMiddleware(globalRateLimiter));

// Enhanced request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Attach request ID to request object
  req.requestId = requestId;

  console.log(JSON.stringify({
    level: 'info',
    type: 'request',
    requestId,
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  }));

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      level: 'info',
      type: 'response',
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      timestamp: new Date().toISOString()
    }));
  });

  next();
});

// Global process-level error logging to avoid silent crashes
process.on('unhandledRejection', (reason) => {
  console.error('[Gemini Backend] Unhandled promise rejection:', reason);
  console.error('[Gemini Backend] Stack:', reason?.stack);
});

process.on('uncaughtException', (err) => {
  console.error('[Gemini Backend] Uncaught exception:', err);
  console.error('[Gemini Backend] Stack:', err?.stack);
});

// Enhanced health check endpoint
app.get('/api/health', (_req, res) => {
  console.log('[Gemini Backend] Health check requested');
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'vibetrip-ai-backend',
      version: '1.0.0',
      checks: {
        gemini: apiKey ? 'configured' : 'missing',
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          unit: 'MB'
        }
      }
    };
    res.json(health);
  } catch (err) {
    console.error('[Gemini Backend] Health check error:', err);
    res.status(500).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Apply stricter rate limiting and validation for Gemini endpoint
app.post('/api/gemini/generate',
  createRateLimitMiddleware(geminiRateLimiter),
  validateGeminiRequest,
  async (req, res) => {
  const requestId = req.requestId || 'unknown';

  try {
    const { model, contents, config } = req.body || {};

    console.log(JSON.stringify({
      level: 'info',
      type: 'gemini_request',
      requestId,
      model,
      hasContents: Boolean(contents),
      hasConfig: Boolean(config),
      timestamp: new Date().toISOString()
    }));

    if (!model || !contents) {
      return res.status(400).json({ error: 'model and contents are required' });
    }

    const startTime = Date.now();
    metrics.geminiCalls++;

    const result = await client.models.generateContent({ model, contents, config });
    const duration = Date.now() - startTime;
    metrics.totalDuration += duration;

    console.log(JSON.stringify({
      level: 'info',
      type: 'gemini_response',
      requestId,
      model,
      hasText: Boolean(result.text),
      duration,
      timestamp: new Date().toISOString()
    }));

    const text = result.text;

    if (!text) {
      return res.status(500).json({ error: 'Empty response from Gemini' });
    }

    res.json({ text });
  } catch (err) {
    metrics.geminiErrors++;

    console.log(JSON.stringify({
      level: 'error',
      type: 'gemini_error',
      requestId,
      error: err.message,
      stack: err?.stack,
      timestamp: new Date().toISOString()
    }));

    // Extract detailed error information from Gemini API errors
    let status = 500;
    let errorResponse = { error: 'Gemini backend error' };

    if (err && typeof err === 'object') {
      // Check if it's a Gemini API error with detailed structure
      if (err.status) {
        status = err.status;
      }

      // Forward the entire error object if it has detailed error info
      if (err.message) {
        errorResponse.error = err.message;
      }

      // If there's a nested error object (common in API errors), forward it
      if (err.error) {
        errorResponse = err.error;
      }
    }

    console.error('[Gemini Backend] Sending error response:', { status, errorResponse });
    res.status(status).json(errorResponse);
  }
});

// Metrics endpoint for monitoring
const metrics = {
  requests: 0,
  errors: 0,
  geminiCalls: 0,
  geminiErrors: 0,
  totalDuration: 0,
  startTime: Date.now()
};

app.get('/api/metrics', (_req, res) => {
  const uptime = Date.now() - metrics.startTime;
  const avgDuration = metrics.geminiCalls > 0 ? metrics.totalDuration / metrics.geminiCalls : 0;

  res.json({
    uptime: Math.floor(uptime / 1000), // in seconds
    requests: {
      total: metrics.requests,
      errors: metrics.errors,
      errorRate: metrics.requests > 0 ? (metrics.errors / metrics.requests * 100).toFixed(2) + '%' : '0%'
    },
    gemini: {
      calls: metrics.geminiCalls,
      errors: metrics.geminiErrors,
      errorRate: metrics.geminiCalls > 0 ? (metrics.geminiErrors / metrics.geminiCalls * 100).toFixed(2) + '%' : '0%',
      avgDuration: Math.round(avgDuration) + 'ms'
    },
    rateLimits: {
      global: globalRateLimiter.getAllStats(),
      gemini: geminiRateLimiter.getAllStats()
    },
    timestamp: new Date().toISOString()
  });
});

// Admin endpoint to reset rate limit for a specific IP
app.post('/api/admin/rate-limit/reset', validateAdminRequest, (req, res) => {
  const { ip, limiter } = req.body;

  if (!ip) {
    return res.status(400).json({ error: 'IP address is required' });
  }

  if (limiter === 'gemini') {
    geminiRateLimiter.reset(ip);
  } else {
    globalRateLimiter.reset(ip);
  }

  res.json({ success: true, message: `Rate limit reset for IP: ${ip}` });
});

// Track metrics in existing endpoints
app.use((req, res, next) => {
  metrics.requests++;
  const originalSend = res.send;
  res.send = function(data) {
    if (res.statusCode >= 400) {
      metrics.errors++;
    }
    return originalSend.call(this, data);
  };
  next();
});

const server = app.listen(PORT, () => {
  console.log(`[Gemini Backend] Server running on http://localhost:${PORT}`);
  console.log(`[Gemini Backend] Ready to accept connections`);
});

server.on('error', (err) => {
  console.error('[Gemini Backend] Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`[Gemini Backend] Port ${PORT} is already in use. Please kill the process using it.`);
    process.exit(1);
  }
  if (err.code === 'EACCES') {
    console.error(`[Gemini Backend] Permission denied on port ${PORT}. Try running as administrator or use a different port.`);
    process.exit(1);
  }
});

// Graceful shutdown - only on explicit Ctrl+C
let isShuttingDown = false;

process.on('SIGINT', () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('\n[Gemini Backend] SIGINT received, closing server...');
  server.close(() => {
    console.log('[Gemini Backend] Server closed');
    process.exit(0);
  });

  // Force exit after 5 seconds
  setTimeout(() => {
    console.log('[Gemini Backend] Forcing exit...');
    process.exit(1);
  }, 5000);
});

