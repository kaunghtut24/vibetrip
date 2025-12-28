/**
 * Centralized Configuration Management
 * 
 * This service provides type-safe access to all configuration values
 * and validates required environment variables at startup.
 */

interface AppConfig {
  // API Keys
  geminiApiKey: string;
  googleMapsApiKey: string;
  
  // Service Configuration
  backendUrl: string;
  port: number;
  
  // Feature Flags
  features: {
    debugMode: boolean;
    enablePdfExport: boolean;
    enableUserProfiles: boolean;
    enablePlugins: boolean;
  };
  
  // Timeouts (in milliseconds)
  timeouts: {
    intent: number;
    discovery: number;
    optimization: number;
    refine: number;
  };
  
  // Retry Configuration
  retry: {
    maxRetries: number;
    backoffBaseMs: number;
  };
  
  // Logging
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableStructuredLogs: boolean;
  };
}

class ConfigService {
  private config: AppConfig;
  
  constructor() {
    this.config = this.loadConfig();
    this.validate();
  }
  
  private loadConfig(): AppConfig {
    return {
      // API Keys - Required
      geminiApiKey: this.getEnv('GEMINI_API_KEY', ''),
      googleMapsApiKey: this.getEnv('GOOGLE_MAPS_API_KEY', ''),
      
      // Service Configuration
      backendUrl: this.getEnv('BACKEND_URL', 'http://localhost:8080'),
      port: parseInt(this.getEnv('PORT', '8080'), 10),
      
      // Feature Flags
      features: {
        debugMode: this.getEnv('DEBUG_MODE', 'false') === 'true',
        enablePdfExport: this.getEnv('ENABLE_PDF_EXPORT', 'true') === 'true',
        enableUserProfiles: this.getEnv('ENABLE_USER_PROFILES', 'true') === 'true',
        enablePlugins: this.getEnv('ENABLE_PLUGINS', 'true') === 'true',
      },
      
      // Timeouts
      timeouts: {
        intent: parseInt(this.getEnv('TIMEOUT_INTENT', '15000'), 10),
        discovery: parseInt(this.getEnv('TIMEOUT_DISCOVERY', '20000'), 10),
        optimization: parseInt(this.getEnv('TIMEOUT_OPTIMIZATION', '35000'), 10),
        refine: parseInt(this.getEnv('TIMEOUT_REFINE', '30000'), 10),
      },
      
      // Retry Configuration
      retry: {
        maxRetries: parseInt(this.getEnv('MAX_RETRIES', '2'), 10),
        backoffBaseMs: parseInt(this.getEnv('BACKOFF_BASE_MS', '1000'), 10),
      },
      
      // Logging
      logging: {
        level: (this.getEnv('LOG_LEVEL', 'info') as 'debug' | 'info' | 'warn' | 'error'),
        enableStructuredLogs: this.getEnv('ENABLE_STRUCTURED_LOGS', 'true') === 'true',
      },
    };
  }
  
  private getEnv(key: string, defaultValue: string): string {
    // In browser environment, check window object
    if (typeof window !== 'undefined' && (window as any).__ENV__) {
      return (window as any).__ENV__[key] || defaultValue;
    }
    
    // In Node.js environment
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key] || defaultValue;
    }
    
    return defaultValue;
  }
  
  private validate(): void {
    const errors: string[] = [];
    
    // Validate required API keys (only in production)
    if (this.config.geminiApiKey === '' && this.getEnv('NODE_ENV', 'development') === 'production') {
      errors.push('GEMINI_API_KEY is required in production');
    }
    
    // Validate timeouts are positive
    Object.entries(this.config.timeouts).forEach(([key, value]) => {
      if (value <= 0) {
        errors.push(`Timeout ${key} must be positive, got ${value}`);
      }
    });
    
    // Validate retry config
    if (this.config.retry.maxRetries < 0) {
      errors.push('MAX_RETRIES must be non-negative');
    }
    
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }
  
  // Getters for easy access
  get geminiApiKey(): string {
    return this.config.geminiApiKey;
  }
  
  get googleMapsApiKey(): string {
    return this.config.googleMapsApiKey;
  }
  
  get backendUrl(): string {
    return this.config.backendUrl;
  }
  
  get port(): number {
    return this.config.port;
  }
  
  get features() {
    return { ...this.config.features };
  }
  
  get timeouts() {
    return { ...this.config.timeouts };
  }

  get retry() {
    return { ...this.config.retry };
  }

  get logging() {
    return { ...this.config.logging };
  }

  // Check if a feature is enabled
  isFeatureEnabled(feature: keyof AppConfig['features']): boolean {
    return this.config.features[feature];
  }

  // Get all config (for debugging)
  getAll(): Readonly<AppConfig> {
    return { ...this.config };
  }
}

// Export singleton instance
export const config = new ConfigService();
export type { AppConfig };

