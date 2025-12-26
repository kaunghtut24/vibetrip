import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

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

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`[Gemini Backend] ${req.method} ${req.url}`);
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

// Simple health check to verify proxy/back-end wiring
app.get('/api/health', (_req, res) => {
  console.log('[Gemini Backend] Health check requested');
  try {
    res.json({ ok: true, hasGeminiApiKey: Boolean(apiKey) });
  } catch (err) {
    console.error('[Gemini Backend] Health check error:', err);
    res.status(500).json({ error: 'Health check failed' });
  }
});

app.post('/api/gemini/generate', async (req, res) => {
  try {
    const { model, contents, config } = req.body || {};

    console.log('[Gemini Backend] Incoming /api/gemini/generate', {
      model,
      hasContents: Boolean(contents),
      hasConfig: Boolean(config),
    });

    if (!model || !contents) {
      return res.status(400).json({ error: 'model and contents are required' });
    }

    console.log('[Gemini Backend] Calling generateContent...');
    const result = await client.models.generateContent({ model, contents, config });
    console.log('[Gemini Backend] Got result:', { hasText: Boolean(result.text) });

    const text = result.text;

    if (!text) {
      return res.status(500).json({ error: 'Empty response from Gemini' });
    }

    res.json({ text });
  } catch (err) {
    console.error('[Gemini Backend] Error:', err);
    console.error('[Gemini Backend] Error stack:', err?.stack);

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

