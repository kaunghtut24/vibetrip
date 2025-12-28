/**
 * Metrics and Performance Monitoring Service
 * 
 * Tracks application performance, API latency, and user interactions
 * for monitoring and optimization.
 */

interface MetricData {
  name: string;
  value: number;
  unit: string;
  tags?: Record<string, string>;
  timestamp: string;
}

interface TimerMetric {
  name: string;
  startTime: number;
  tags?: Record<string, string>;
}

class MetricsService {
  private metrics: MetricData[] = [];
  private timers: Map<string, TimerMetric> = new Map();
  
  /**
   * Record a metric value
   */
  record(name: string, value: number, unit: string = 'count', tags?: Record<string, string>): void {
    const metric: MetricData = {
      name,
      value,
      unit,
      tags,
      timestamp: new Date().toISOString()
    };
    
    this.metrics.push(metric);
    
    // Log metric in structured format
    console.log(JSON.stringify({
      level: 'info',
      type: 'metric',
      ...metric
    }));
    
    // Keep only last 1000 metrics in memory
    if (this.metrics.length > 1000) {
      this.metrics.shift();
    }
  }
  
  /**
   * Start a timer for measuring duration
   */
  startTimer(name: string, tags?: Record<string, string>): string {
    const timerId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.timers.set(timerId, {
      name,
      startTime: performance.now(),
      tags
    });
    
    return timerId;
  }
  
  /**
   * Stop a timer and record the duration
   */
  stopTimer(timerId: string): number | null {
    const timer = this.timers.get(timerId);
    
    if (!timer) {
      console.warn(`Timer ${timerId} not found`);
      return null;
    }
    
    const duration = performance.now() - timer.startTime;
    
    this.record(timer.name, duration, 'ms', timer.tags);
    this.timers.delete(timerId);
    
    return duration;
  }
  
  /**
   * Measure the duration of an async function
   */
  async measure<T>(name: string, fn: () => Promise<T>, tags?: Record<string, string>): Promise<T> {
    const timerId = this.startTimer(name, tags);
    
    try {
      const result = await fn();
      this.stopTimer(timerId);
      return result;
    } catch (error) {
      this.stopTimer(timerId);
      this.record(`${name}_error`, 1, 'count', tags);
      throw error;
    }
  }
  
  /**
   * Increment a counter
   */
  increment(name: string, value: number = 1, tags?: Record<string, string>): void {
    this.record(name, value, 'count', tags);
  }
  
  /**
   * Record a gauge value (current state)
   */
  gauge(name: string, value: number, unit: string = 'value', tags?: Record<string, string>): void {
    this.record(name, value, unit, tags);
  }
  
  /**
   * Get all recorded metrics
   */
  getMetrics(): MetricData[] {
    return [...this.metrics];
  }
  
  /**
   * Get metrics summary
   */
  getSummary(): Record<string, any> {
    const summary: Record<string, any> = {};
    
    this.metrics.forEach(metric => {
      if (!summary[metric.name]) {
        summary[metric.name] = {
          count: 0,
          sum: 0,
          min: Infinity,
          max: -Infinity,
          unit: metric.unit
        };
      }
      
      const stat = summary[metric.name];
      stat.count++;
      stat.sum += metric.value;
      stat.min = Math.min(stat.min, metric.value);
      stat.max = Math.max(stat.max, metric.value);
      stat.avg = stat.sum / stat.count;
    });
    
    return summary;
  }
  
  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
    this.timers.clear();
  }
}

// Export singleton instance
export const metrics = new MetricsService();

// Convenience functions for common metrics
export const trackApiCall = (endpoint: string, duration: number, success: boolean): void => {
  metrics.record('api_call_duration', duration, 'ms', { endpoint, success: String(success) });
  metrics.increment('api_call_count', 1, { endpoint, success: String(success) });
};

export const trackAgentExecution = (agent: string, duration: number, success: boolean): void => {
  metrics.record('agent_execution_duration', duration, 'ms', { agent, success: String(success) });
  metrics.increment('agent_execution_count', 1, { agent, success: String(success) });
};

export const trackUserAction = (action: string): void => {
  metrics.increment('user_action', 1, { action });
};

