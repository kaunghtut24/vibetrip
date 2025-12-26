import { Trip, TripIntent, DiscoveryResult, Itinerary, UserProfile } from "../types";

const STORAGE_KEY_LATEST = "vibetrip_trips_latest";
const STORAGE_KEY_HISTORY = "vibetrip_trips_history";
const STORAGE_KEY_USERS = "vibetrip_users";

// --- TRIP OPERATIONS ---

/**
 * Saves a trip, automatically handling versioning.
 * If the trip ID exists, it creates a new version.
 * If not, it starts at version 1.
 */
export const saveTrip = async (data: {
  id: string;
  userId?: string;
  status?: Trip['status'];
  intent: TripIntent;
  discovery?: DiscoveryResult | null;
  optimizedPlans?: Itinerary[];
  selectedPlanId?: string;
}): Promise<Trip> => {
  await new Promise(resolve => setTimeout(resolve, 400)); // Simulate network

  const latestStore = JSON.parse(localStorage.getItem(STORAGE_KEY_LATEST) || "{}");
  const historyStore = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || "{}");
  
  // Update User History if new trip
  const userId = data.userId || 'user_guest';
  if (!latestStore[data.id]) {
      const userProfile = await getUserProfile(userId);
      if (userProfile && !userProfile.tripHistory.includes(data.id)) {
          userProfile.tripHistory.push(data.id);
          await saveUserProfile(userProfile);
      }
  }

  const existing = latestStore[data.id] as Trip | undefined;
  const now = new Date().toISOString();

  let newTrip: Trip;

  if (existing) {
    // UPDATE: Increment version
    newTrip = {
      ...existing,
      ...data, // Overwrite with new data
      version: existing.version + 1,
      updatedAt: now,
      // Ensure complex objects are updated if provided, else keep existing
      discovery: data.discovery !== undefined ? data.discovery : existing.discovery,
      optimizedPlans: data.optimizedPlans !== undefined ? data.optimizedPlans : existing.optimizedPlans,
    };
  } else {
    // CREATE: Version 1
    newTrip = {
      id: data.id,
      userId: userId,
      version: 1,
      createdAt: now,
      updatedAt: now,
      status: data.status || 'draft',
      intent: data.intent,
      discovery: data.discovery || null,
      optimizedPlans: data.optimizedPlans || [],
      selectedPlanId: data.selectedPlanId
    };
  }

  // 1. Update Latest Pointer
  latestStore[newTrip.id] = newTrip;
  localStorage.setItem(STORAGE_KEY_LATEST, JSON.stringify(latestStore));

  // 2. Append to History
  const history = historyStore[newTrip.id] || [];
  history.push(newTrip);
  historyStore[newTrip.id] = history;
  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(historyStore));

  console.log(`[TripStore] Saved Trip ${newTrip.id} (v${newTrip.version})`);
  return newTrip;
};

/**
 * Retrieves the latest version of a trip.
 */
export const getTrip = async (id: string): Promise<Trip | null> => {
  await new Promise(resolve => setTimeout(resolve, 200));
  const store = JSON.parse(localStorage.getItem(STORAGE_KEY_LATEST) || "{}");
  return store[id] || null;
};

/**
 * Retrieves full history of a trip.
 */
export const getTripHistory = async (id: string): Promise<Trip[]> => {
  await new Promise(resolve => setTimeout(resolve, 200));
  const store = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || "{}");
  return store[id] || [];
};

/**
 * Rolls back a trip to a specific version.
 * Creates a NEW version that is a copy of the target version.
 */
export const rollbackTrip = async (id: string, targetVersion: number): Promise<Trip> => {
  console.log(`[TripStore] Rolling back ${id} to v${targetVersion}...`);
  const history = await getTripHistory(id);
  const targetSnapshot = history.find(t => t.version === targetVersion);

  if (!targetSnapshot) {
    throw new Error(`Version ${targetVersion} not found for trip ${id}`);
  }

  // Create new version based on the old snapshot
  // We explicitly destructure to avoid copying the old version number directly
  const { version: oldVersion, updatedAt: oldUpdated, ...tripData } = targetSnapshot;

  // Call saveTrip to handle the logic of creating the new version (latest + 1)
  return saveTrip({
    ...tripData,
    id: id
  });
};

// --- USER PROFILE OPERATIONS ---

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
    const store = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || "{}");
    let profile = store[userId];

    // Initialize default if not found
    if (!profile && userId === 'user_guest') {
        profile = {
            id: 'user_guest',
            name: 'Guest Traveler',
            email: 'guest@vibetrip.ai',
            preferences: {
                pace: 'Moderate',
                budgetTier: 'Moderate',
                accessibility: [],
                dietaryRestrictions: []
            },
            tripHistory: []
        };
        store[userId] = profile;
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(store));
    }

    return profile || null;
};

export const saveUserProfile = async (profile: UserProfile): Promise<UserProfile> => {
    const store = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || "{}");
    store[profile.id] = profile;
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(store));
    console.log(`[UserStore] Saved profile for ${profile.name}`);
    return profile;
};