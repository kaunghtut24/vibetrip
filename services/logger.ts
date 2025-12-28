import { trackAgentExecution } from './metrics';

export interface AgentLog {
  id: string;
  agentName: string;
  timestamp: number;
  durationMs?: number;
  inputHash: string;
  outputHash?: string;
  inputPreview: string; // Truncated preview for UI
  confidence?: number;
  status: 'RUNNING' | 'SUCCESS' | 'ERROR';
  error?: string;
}

const simpleHash = (data: any): string => {
  try {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    let hash = 0;
    if (str.length === 0) return '0';
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  } catch (e) {
    return 'hash-error';
  }
};

const formatPreview = (data: any): string => {
  try {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    return str.length > 100 ? str.substring(0, 100) + '...' : str;
  } catch (e) {
    return 'preview-error';
  }
};

class LoggerService {
  private logs: AgentLog[] = [];
  private listeners: ((logs: AgentLog[]) => void)[] = [];

  constructor() {
    // Load from session storage if available to persist across reloads
    try {
      const saved = sessionStorage.getItem('vibetrip_debug_logs');
      if (saved) {
        this.logs = JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Failed to load logs");
    }
  }

  private notify() {
    this.listeners.forEach(cb => cb([...this.logs]));
    try {
      sessionStorage.setItem('vibetrip_debug_logs', JSON.stringify(this.logs));
    } catch (e) { /* ignore */ }
  }

  subscribe(callback: (logs: AgentLog[]) => void): () => void {
    this.listeners.push(callback);
    callback([...this.logs]);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  start(agentName: string, input: any): string {
    const id = Math.random().toString(36).substr(2, 9);
    const log: AgentLog = {
      id,
      agentName,
      timestamp: Date.now(),
      inputHash: simpleHash(input),
      inputPreview: formatPreview(input),
      status: 'RUNNING'
    };
    this.logs.unshift(log); // Prepend
    this.notify();
    return id;
  }

  success(id: string, output: any, confidence?: number) {
    const log = this.logs.find(l => l.id === id);
    if (log) {
      log.status = 'SUCCESS';
      log.durationMs = Date.now() - log.timestamp;
      log.outputHash = simpleHash(output);
      log.confidence = confidence;

      // Track metrics
      trackAgentExecution(log.agentName, log.durationMs, true);

      this.notify();
    }
  }

  error(id: string, error: any) {
    const log = this.logs.find(l => l.id === id);
    if (log) {
      log.status = 'ERROR';
      log.durationMs = Date.now() - log.timestamp;
      log.error = error.message || String(error);

      // Track metrics
      trackAgentExecution(log.agentName, log.durationMs, false);

      this.notify();
    }
  }
  
  clear() {
    this.logs = [];
    sessionStorage.removeItem('vibetrip_debug_logs');
    this.notify();
  }
}

export const agentLogger = new LoggerService();