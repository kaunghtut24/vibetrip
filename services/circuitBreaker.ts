/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascading failures by stopping requests to a failing service
 * and allowing it time to recover.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests are rejected immediately
 * - HALF_OPEN: Testing if service has recovered
 */

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

interface CircuitBreakerOptions {
  failureThreshold: number;      // Number of failures before opening circuit
  successThreshold: number;      // Number of successes to close circuit from half-open
  timeout: number;               // Time in ms before attempting to close circuit
  name: string;                  // Name for logging
}

interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number | null = null;
  private nextAttemptTime: number = 0;
  
  // Stats
  private totalRequests: number = 0;
  private totalFailures: number = 0;
  private totalSuccesses: number = 0;
  
  constructor(private options: CircuitBreakerOptions) {}
  
  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;
    
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      // Check if enough time has passed to try again
      if (Date.now() < this.nextAttemptTime) {
        throw new Error(`Circuit breaker [${this.options.name}] is OPEN. Service temporarily unavailable.`);
      }
      
      // Move to half-open state to test
      this.state = CircuitState.HALF_OPEN;
      this.successCount = 0;
      console.log(`[CircuitBreaker:${this.options.name}] Moving to HALF_OPEN state`);
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.totalSuccesses++;
    this.failureCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.options.successThreshold) {
        this.state = CircuitState.CLOSED;
        console.log(`[CircuitBreaker:${this.options.name}] Circuit CLOSED after ${this.successCount} successes`);
      }
    }
  }
  
  private onFailure(): void {
    this.totalFailures++;
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.state === CircuitState.HALF_OPEN) {
      // Immediately open circuit if failure in half-open state
      this.openCircuit();
    } else if (this.failureCount >= this.options.failureThreshold) {
      this.openCircuit();
    }
  }
  
  private openCircuit(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = Date.now() + this.options.timeout;
    
    console.log(JSON.stringify({
      level: 'warn',
      type: 'circuit_breaker_open',
      name: this.options.name,
      failureCount: this.failureCount,
      nextAttemptTime: new Date(this.nextAttemptTime).toISOString(),
      timestamp: new Date().toISOString()
    }));
  }
  
  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failureCount,
      successes: this.successCount,
      lastFailureTime: this.lastFailureTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses
    };
  }
  
  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    console.log(`[CircuitBreaker:${this.options.name}] Manually reset to CLOSED state`);
  }
}

// Create circuit breakers for different services
export const geminiCircuitBreaker = new CircuitBreaker({
  name: 'Gemini API',
  failureThreshold: 5,      // Open after 5 consecutive failures
  successThreshold: 2,      // Close after 2 consecutive successes
  timeout: 60000            // Wait 60 seconds before retry
});

export const mapsCircuitBreaker = new CircuitBreaker({
  name: 'Google Maps API',
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 30000
});

