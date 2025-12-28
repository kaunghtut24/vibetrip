/**
 * Rate Limiter Service
 * 
 * Implements token bucket algorithm for rate limiting API requests.
 * Prevents abuse and ensures fair usage across users.
 */

interface RateLimitConfig {
  maxTokens: number;        // Maximum tokens in bucket
  refillRate: number;       // Tokens added per second
  windowMs: number;         // Time window for rate limiting
}

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private buckets: Map<string, RateLimitBucket> = new Map();
  private config: RateLimitConfig;
  
  constructor(config: RateLimitConfig) {
    this.config = config;
    
    // Clean up old buckets every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }
  
  /**
   * Check if a request is allowed for the given key (e.g., IP address)
   * Returns true if allowed, false if rate limited
   */
  async checkLimit(key: string): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    
    // Create new bucket if doesn't exist
    if (!bucket) {
      bucket = {
        tokens: this.config.maxTokens,
        lastRefill: now
      };
      this.buckets.set(key, bucket);
    }
    
    // Refill tokens based on time elapsed
    const timePassed = (now - bucket.lastRefill) / 1000; // in seconds
    const tokensToAdd = timePassed * this.config.refillRate;
    bucket.tokens = Math.min(this.config.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
    
    // Check if we have tokens available
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        resetIn: Math.ceil((this.config.maxTokens - bucket.tokens) / this.config.refillRate * 1000)
      };
    }
    
    // Rate limited
    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.ceil((1 - bucket.tokens) / this.config.refillRate * 1000)
    };
  }
  
  /**
   * Clean up old buckets that haven't been used recently
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = this.config.windowMs * 2; // Keep buckets for 2x the window
    
    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > maxAge) {
        this.buckets.delete(key);
      }
    }
    
    console.log(`[RateLimiter] Cleaned up old buckets. Active buckets: ${this.buckets.size}`);
  }
  
  /**
   * Get current stats for a key
   */
  getStats(key: string): { tokens: number; maxTokens: number } | null {
    const bucket = this.buckets.get(key);
    if (!bucket) return null;
    
    return {
      tokens: Math.floor(bucket.tokens),
      maxTokens: this.config.maxTokens
    };
  }
  
  /**
   * Reset rate limit for a key (admin function)
   */
  reset(key: string): void {
    this.buckets.delete(key);
    console.log(`[RateLimiter] Reset rate limit for key: ${key}`);
  }
  
  /**
   * Get all active buckets (for monitoring)
   */
  getAllStats(): Map<string, { tokens: number; lastRefill: number }> {
    return new Map(this.buckets);
  }
}

// Create rate limiters for different endpoints
export const globalRateLimiter = new RateLimiter({
  maxTokens: 100,           // 100 requests
  refillRate: 10,           // 10 requests per second
  windowMs: 60 * 1000       // 1 minute window
});

export const geminiRateLimiter = new RateLimiter({
  maxTokens: 20,            // 20 Gemini calls
  refillRate: 1,            // 1 call per second
  windowMs: 60 * 1000       // 1 minute window
});

export const strictRateLimiter = new RateLimiter({
  maxTokens: 10,            // 10 requests
  refillRate: 0.5,          // 1 request per 2 seconds
  windowMs: 60 * 1000       // 1 minute window
});

/**
 * Express middleware for rate limiting
 */
export function createRateLimitMiddleware(limiter: RateLimiter) {
  return async (req: any, res: any, next: any) => {
    // Use IP address as key (or user ID if authenticated)
    const key = req.ip || req.connection.remoteAddress || 'unknown';
    
    const result = await limiter.checkLimit(key);
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', limiter['config'].maxTokens);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + result.resetIn).toISOString());
    
    if (!result.allowed) {
      console.log(JSON.stringify({
        level: 'warn',
        type: 'rate_limit_exceeded',
        ip: key,
        resetIn: result.resetIn,
        timestamp: new Date().toISOString()
      }));
      
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(result.resetIn / 1000) // in seconds
      });
    }
    
    next();
  };
}

