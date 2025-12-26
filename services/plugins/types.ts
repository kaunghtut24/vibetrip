import { TripIntent, DiscoveryResult, Itinerary } from '../../types';

export enum PluginStage {
  POST_INTENT = 'POST_INTENT',
  POST_DISCOVERY = 'POST_DISCOVERY',
  POST_OPTIMIZATION = 'POST_OPTIMIZATION'
}

export interface PluginContext {
  intent?: TripIntent;
  discovery?: DiscoveryResult;
  itineraries?: Itinerary[];
}

export interface PluginResult {
  id: string;
  message?: string; // User-facing message
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  data?: any;       // Structured data for other systems
}

export interface PluginAgent {
  id: string;
  name: string;
  description: string;
  stage: PluginStage;

  /**
   * Check if the plugin should run for the given context.
   */
  evaluate(context: PluginContext): Promise<boolean>;

  /**
   * Execute the plugin logic.
   */
  execute(context: PluginContext): Promise<PluginResult>;
}
