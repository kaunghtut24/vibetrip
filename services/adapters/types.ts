import { Place, Coordinates, Flight } from '../../types';

export type AdapterMode = 'MOCK' | 'LIVE';

export interface IMapsAdapter {
  /**
   * Search for places (POI, restaurants, etc.)
   */
  searchPlaces(query: string, location?: Coordinates, radiusMeters?: number): Promise<Place[]>;
  
  /**
   * Get basic routing info between two points
   */
  getRouteInfo(origin: Coordinates, destination: Coordinates): Promise<{ distance: string; duration: string }>;
}

export interface IActivitiesAdapter {
  /**
   * Search for specific activities or tours
   */
  searchActivities(destination: string, categories: string[], budgetLevel?: string): Promise<Place[]>;
}

export interface IFlightsAdapter {
  /**
   * Search for flight options
   */
  searchFlights(origin: string, destination: string, departureDate: string): Promise<Flight[]>;
}

export const ADAPTER_CONFIG = {
  useLive: process.env.USE_LIVE_ADAPTERS === 'true' || false,
};