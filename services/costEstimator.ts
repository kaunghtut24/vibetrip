import { CurrencyInfo } from "../types";

export interface CostEstimationResult {
  minCost: number;
  maxCost: number;
  currency: string;
  formatted: string;
}

// Tier 1: Very Expensive Cities (Base USD multiplier 1.6x)
const TIER_1_CITIES = [
  'New York', 'London', 'Paris', 'Tokyo', 'Zurich', 'Singapore', 
  'San Francisco', 'Reykjavik', 'Dubai', 'Sydney', 'Hong Kong', 'Copenhagen', 'Oslo', 'Geneva'
];

// Tier 3: Budget-Friendly Cities (Base USD multiplier 0.5x)
const TIER_3_CITIES = [
  'Bangkok', 'Hanoi', 'Cairo', 'Delhi', 'Bali', 'Mexico City', 
  'Istanbul', 'Manila', 'Buenos Aires', 'Lima', 'Ho Chi Minh City', 'Prague', 'Budapest', 'Lisbon'
];

// Base costs in USD for a "Moderate" budget in a "Tier 2" (Standard) city
// Format: [Min, Max]
const BASE_COSTS: Record<string, [number, number]> = {
  'Hotel': [120, 220],     // per night
  'Food': [20, 50],        // per meal
  'Activity': [20, 60],    // per ticket/entry/tour
  'Landmark': [5, 25],     // entry fee
  'default': [10, 40]
};

const formatLocalAmount = (amount: number, currency: CurrencyInfo): string => {
  // Rounding Rules
  let rounded = amount;
  
  // Zero-decimal currencies (JPY, KRW, VND, etc)
  if (['JPY', 'KRW', 'VND', 'HUF', 'IDR'].includes(currency.code)) {
    rounded = Math.round(amount / 100) * 100; // Round to nearest 100
    return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: currency.code, 
        maximumFractionDigits: 0 
    }).format(rounded);
  }
  
  // High-value currencies (KWD, BHD) -> keep precision
  if (['KWD', 'BHD', 'OMR'].includes(currency.code)) {
     return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: currency.code, 
        maximumFractionDigits: 3 
    }).format(rounded);
  }

  // Standard currencies (USD, EUR, GBP) -> Round to nearest 1 or 5
  if (amount > 50) rounded = Math.round(amount / 5) * 5;
  else rounded = Math.round(amount);

  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: currency.code, 
    maximumFractionDigits: 0 
  }).format(rounded);
};

/**
 * Estimates cost in LOCAL currency based on heuristics + provided exchange rate.
 */
export const estimateActivityCost = (
  activityType: string,
  city: string,
  budgetLevel: string,
  currencyInfo: CurrencyInfo
): CostEstimationResult => {
  
  // 1. Determine City Multiplier (Cost of Living Index Proxy)
  let cityMultiplier = 1.0;
  const normalizedCity = city.toLowerCase();
  
  if (TIER_1_CITIES.some(c => normalizedCity.includes(c.toLowerCase()))) {
    cityMultiplier = 1.6;
  } else if (TIER_3_CITIES.some(c => normalizedCity.includes(c.toLowerCase()))) {
    cityMultiplier = 0.5;
  }

  // 2. Determine Budget Multiplier
  let budgetMultiplier = 1.0;
  switch (budgetLevel) {
    case 'Budget': budgetMultiplier = 0.6; break;
    case 'Luxury': budgetMultiplier = 3.5; break;
    case 'Moderate': 
    default: budgetMultiplier = 1.1; break;
  }

  // 3. Get Base Range in USD
  const range = BASE_COSTS[activityType] || BASE_COSTS['default'];

  // 4. Convert USD to Local Currency
  // Formula: BaseUSD * CityMult * BudgetMult * ExchangeRate
  let minCost = range[0] * cityMultiplier * budgetMultiplier * currencyInfo.rateToUSD;
  let maxCost = range[1] * cityMultiplier * budgetMultiplier * currencyInfo.rateToUSD;

  // 5. Apply Special Heuristics
  // Rule: Landmarks in Budget mode are often free (viewing from outside or cheap entry)
  if (activityType === 'Landmark' && budgetLevel === 'Budget') {
    minCost = 0; 
    maxCost = Math.min(maxCost, 15 * currencyInfo.rateToUSD);
  }

  // 6. Formatting
  const minStr = formatLocalAmount(minCost, currencyInfo);
  const maxStr = formatLocalAmount(maxCost, currencyInfo);
  
  let formattedString = `${minStr}-${maxStr}`;
  if (minCost <= 1 && maxCost <= 1) formattedString = "Free";
  else if (minCost <= 1) formattedString = `Free-${maxStr}`;

  return {
    minCost: Math.round(minCost),
    maxCost: Math.round(maxCost),
    currency: currencyInfo.code,
    formatted: formattedString
  };
};