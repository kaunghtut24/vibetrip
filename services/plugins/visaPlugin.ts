import { PluginAgent, PluginContext, PluginResult, PluginStage } from './types';

export class VisaPlugin implements PluginAgent {
  id = 'visa-checker-v1';
  name = 'Global Visa Assistant';
  description = 'Checks visa requirements for international destinations.';
  stage = PluginStage.POST_INTENT;

  async evaluate(context: PluginContext): Promise<boolean> {
    // Simple heuristic: If destination is set, we run.
    // In a real app, we'd check if destination !== user.origin
    return !!context.intent?.destination;
  }

  async execute(context: PluginContext): Promise<PluginResult> {
    const destination = context.intent!.destination;
    
    // Mock Logic: Simulate checking a database
    // In production, this would call an external API (e.g., Sherpa, VisaHQ)
    
    return {
      id: this.id,
      severity: 'WARNING',
      message: `🛂 **Visa Check**: Planning a trip to ${destination}? Ensure your passport has at least 6 months validity. Check specific visa requirements early!`
    };
  }
}
