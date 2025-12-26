import { IMapsAdapter, ADAPTER_CONFIG } from './types';
import { Place, Coordinates } from '../../types';

// --- MOCK IMPLEMENTATION ---
class MockMapsAdapter implements IMapsAdapter {
  async searchPlaces(query: string, location?: Coordinates): Promise<Place[]> {
    console.log(`[MockMaps] Searching for "${query}" near`, location);
    // Return deterministic mock data based on query
    return [
      {
        name: `${query} (Mock Place)`,
        description: "A popular local spot with great reviews.",
        type: 'Landmark',
        estimatedCost: "$10-20",
        rating: 4.5,
        address: "123 Mock Street, City Center",
        coordinates: location || { lat: 0, lng: 0 }
      },
      {
        name: `The Grand ${query} Hotel`,
        description: "Luxury accommodation in the heart of the city.",
        type: 'Hotel',
        estimatedCost: "$250/night",
        rating: 4.8,
        address: "456 Plaza Ave",
        coordinates: location ? { lat: location.lat + 0.01, lng: location.lng + 0.01 } : { lat: 0, lng: 0 }
      }
    ];
  }

  async getRouteInfo(origin: Coordinates, destination: Coordinates): Promise<{ distance: string; duration: string }> {
    return {
      distance: "5.2 km",
      duration: "15 mins"
    };
  }
}

// --- LIVE IMPLEMENTATION (Google Maps) ---
class GoogleMapsAdapter implements IMapsAdapter {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    if (!this.apiKey) {
      console.warn("[GoogleMapsAdapter] No API Key found. Fallback to mock behavior might be needed.");
    }
  }

  async searchPlaces(query: string, location?: Coordinates): Promise<Place[]> {
    if (!this.apiKey) throw new Error("Google Maps API Key missing");

    // Example implementation using Google Places API (New) - Text Search
    // Note: In a real app, this should likely go through a backend proxy to protect the key
    const url = `https://places.googleapis.com/v1/places:searchText`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.priceLevel'
        },
        body: JSON.stringify({
          textQuery: query,
          locationBias: location ? {
            circle: {
              center: { latitude: location.lat, longitude: location.lng },
              radius: 5000
            }
          } : undefined
        })
      });

      const data = await response.json();
      
      return (data.places || []).map((p: any) => ({
        name: p.displayName?.text || 'Unknown Place',
        description: p.formattedAddress,
        type: 'Landmark', // Default, would need refinement based on 'types'
        estimatedCost: p.priceLevel ? '$$' : 'Free', // Simplification
        rating: p.rating,
        coordinates: {
          lat: p.location.latitude,
          lng: p.location.longitude
        }
      }));

    } catch (error) {
      console.error("[GoogleMapsAdapter] Error:", error);
      return [];
    }
  }

  async getRouteInfo(origin: Coordinates, destination: Coordinates): Promise<{ distance: string; duration: string }> {
    // In a real implementation, call Google Routes API
    return { distance: "Unknown", duration: "Unknown" }; 
  }
}

// --- EXPORT ---
export const mapsAdapter: IMapsAdapter = ADAPTER_CONFIG.useLive 
  ? new GoogleMapsAdapter() 
  : new MockMapsAdapter();