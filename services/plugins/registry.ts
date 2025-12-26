import { PluginAgent, PluginContext, PluginStage, PluginResult } from './types';
import { VisaPlugin } from './visaPlugin';

class PluginRegistry {
  private plugins: PluginAgent[] = [];

  constructor() {
    // Register Default Plugins
    this.register(new VisaPlugin());
  }

  register(plugin: PluginAgent) {
    console.log(`[PluginRegistry] Registered: ${plugin.name}`);
    this.plugins.push(plugin);
  }

  /**
   * Runs all plugins registered for a specific stage.
   * Returns an array of results from executed plugins.
   */
  async runStage(stage: PluginStage, context: PluginContext): Promise<PluginResult[]> {
    const applicablePlugins = this.plugins.filter(p => p.stage === stage);
    const results: PluginResult[] = [];

    for (const plugin of applicablePlugins) {
      try {
        const shouldRun = await plugin.evaluate(context);
        if (shouldRun) {
          console.log(`[PluginRegistry] Executing ${plugin.name} @ ${stage}`);
          const result = await plugin.execute(context);
          results.push(result);
        }
      } catch (error) {
        console.error(`[PluginRegistry] Error executing ${plugin.name}:`, error);
        // We swallow errors so plugins don't crash the main flow
      }
    }

    return results;
  }
}

export const pluginRegistry = new PluginRegistry();
