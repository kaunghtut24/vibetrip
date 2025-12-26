import { IFlightsAdapter, ADAPTER_CONFIG } from './types';
import { Flight } from '../../types';

// --- MOCK IMPLEMENTATION ---
class MockFlightsAdapter implements IFlightsAdapter {
  async searchFlights(origin: string, destination: string, departureDate: string): Promise<Flight[]> {
    console.log(`[MockFlights] Searching flights from ${origin} to ${destination} on ${departureDate}`);
    
    return [
      {
        id: "fl_001",
        airline: "MockAir",
        flightNumber: "MA101",
        origin: origin || "JFK",
        destination: destination,
        departureTime: `${departureDate}T08:00:00`,
        arrivalTime: `${departureDate}T11:30:00`,
        price: "$450",
        bookingUrl: "https://example.com/book"
      },
      {
        id: "fl_002",
        airline: "BudgetFly",
        flightNumber: "BF404",
        origin: origin || "JFK",
        destination: destination,
        departureTime: `${departureDate}T14:00:00`,
        arrivalTime: `${departureDate}T17:45:00`,
        price: "$320",
        bookingUrl: "https://example.com/book"
      }
    ];
  }
}

// --- LIVE IMPLEMENTATION (Amadeus placeholder) ---
class AmadeusAdapter implements IFlightsAdapter {
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.clientId = process.env.AMADEUS_CLIENT_ID || '';
    this.clientSecret = process.env.AMADEUS_CLIENT_SECRET || '';
  }

  async searchFlights(origin: string, destination: string, departureDate: string): Promise<Flight[]> {
    if (!this.clientId || !this.clientSecret) {
       console.warn("[AmadeusAdapter] Missing Credentials.");
       return [];
    }
    // Auth and Search logic would go here
    return [];
  }
}

// --- EXPORT ---
export const flightsAdapter: IFlightsAdapter = ADAPTER_CONFIG.useLive 
  ? new AmadeusAdapter() 
  : new MockFlightsAdapter();