import { IActivitiesAdapter, ADAPTER_CONFIG } from './types';
import { Place } from '../../types';

// --- MOCK IMPLEMENTATION ---
class MockActivitiesAdapter implements IActivitiesAdapter {
  async searchActivities(destination: string, categories: string[], budgetLevel?: string): Promise<Place[]> {
    console.log(`[MockActivities] Searching for ${categories.join(', ')} in ${destination}`);
    
    // Simulate generic results
    return [
      {
        name: `${destination} City Tour`,
        description: "A comprehensive guided walking tour of the historic district.",
        type: 'Activity',
        estimatedCost: "$45",
        rating: 4.7,
        imageUrl: `https://picsum.photos/400/300?random=${Math.floor(Math.random() * 100)}`
      },
      {
        name: "Local Food Tasting Adventure",
        description: "Taste the best street food and hidden gems.",
        type: 'Food',
        estimatedCost: "$60",
        rating: 4.9,
        imageUrl: `https://picsum.photos/400/300?random=${Math.floor(Math.random() * 100)}`
      },
      {
        name: "National Museum Entry",
        description: "Skip-the-line tickets to the main museum.",
        type: 'Activity',
        estimatedCost: "$25",
        rating: 4.6,
        imageUrl: `https://picsum.photos/400/300?random=${Math.floor(Math.random() * 100)}`
      }
    ];
  }
}

// --- LIVE IMPLEMENTATION (Tripadvisor/Viator placeholder) ---
class TripadvisorAdapter implements IActivitiesAdapter {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.TRIPADVISOR_API_KEY || '';
  }

  async searchActivities(destination: string, categories: string[]): Promise<Place[]> {
    if (!this.apiKey) {
      console.warn("[TripadvisorAdapter] Missing API Key. Falling back to empty.");
      return [];
    }
    // Implementation would go here (fetch from https://api.content.tripadvisor.com/api/v1/...)
    return []; 
  }
}

// --- EXPORT ---
export const activitiesAdapter: IActivitiesAdapter = ADAPTER_CONFIG.useLive 
  ? new TripadvisorAdapter() 
  : new MockActivitiesAdapter();