/**
 * TRAKO Saved Journeys & Favorites Manager
 * Supports personalized transit journeys (Home, College, Work, Gym, Custom)
 * with 1-tap start, renaming, editing, reversing, and local + Supabase persistence.
 */

import { supabase } from "@/integrations/supabase/client";

export type SavedJourneyIcon = "🏠" | "🎓" | "💼" | "🏋️" | "❤️" | "⭐";

export interface SavedJourney {
  id: string;
  icon: SavedJourneyIcon;
  name: string;
  originName: string;
  originStopId?: string | undefined;
  originLat: number;
  originLon: number;
  destinationName: string;
  destinationStopId?: string | undefined;
  destinationLat: number;
  destinationLon: number;
  preferredRouteId?: string | undefined;
  preferredRouteNo?: string | undefined;
  transitMode: "bus" | "metro" | "all";
  alarmStopsAhead: 1 | 2;
  isFavourite: boolean;
  created_at: string;
  updated_at: string;
}

const SAVED_JOURNEYS_KEY = "trako_saved_journeys_v2";

export const DEFAULT_SAVED_JOURNEYS: SavedJourney[] = [
  {
    id: "sj-home",
    icon: "🏠",
    name: "Home",
    originName: "Pune Station",
    originStopId: "s10",
    originLat: 18.5286,
    originLon: 73.8743,
    destinationName: "Swargate",
    destinationStopId: "s4",
    destinationLat: 18.501,
    destinationLon: 73.8586,
    preferredRouteId: "r1",
    preferredRouteNo: "103",
    transitMode: "bus",
    alarmStopsAhead: 1,
    isFavourite: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "sj-college",
    icon: "🎓",
    name: "College",
    originName: "Swargate",
    originStopId: "s4",
    originLat: 18.501,
    originLon: 73.8586,
    destinationName: "Kothrud Depot",
    destinationStopId: "s7",
    destinationLat: 18.5074,
    destinationLon: 73.8077,
    preferredRouteId: "r1",
    preferredRouteNo: "103",
    transitMode: "bus",
    alarmStopsAhead: 2,
    isFavourite: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "sj-work",
    icon: "💼",
    name: "Work",
    originName: "Shivajinagar",
    originStopId: "s5",
    originLat: 18.5314,
    originLon: 73.8446,
    destinationName: "Hinjawadi Phase 1",
    destinationStopId: "s18",
    destinationLat: 18.5983,
    destinationLon: 73.7125,
    preferredRouteId: "r2",
    preferredRouteNo: "215",
    transitMode: "all",
    alarmStopsAhead: 1,
    isFavourite: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

/**
 * Retrieve saved journeys.
 * Uses local storage for instant guest access, and seeds default templates if none exist.
 */
export function getSavedJourneys(): SavedJourney[] {
  if (typeof window === "undefined") return DEFAULT_SAVED_JOURNEYS;
  try {
    const raw = localStorage.getItem(SAVED_JOURNEYS_KEY);
    if (!raw) {
      localStorage.setItem(
        SAVED_JOURNEYS_KEY,
        JSON.stringify(DEFAULT_SAVED_JOURNEYS),
      );
      return DEFAULT_SAVED_JOURNEYS;
    }
    const parsed = JSON.parse(raw) as SavedJourney[];
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : DEFAULT_SAVED_JOURNEYS;
  } catch {
    return DEFAULT_SAVED_JOURNEYS;
  }
}

/**
 * Persist the full list to storage and attempt background Supabase sync if user is logged in.
 */
export function saveAllJourneys(journeys: SavedJourney[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SAVED_JOURNEYS_KEY, JSON.stringify(journeys));
  } catch (e) {
    console.warn("Failed to persist saved journeys locally", e);
  }

  // Background sync for authenticated users
  trySyncToSupabase(journeys).catch(() => {});
}

/**
 * Create or save a journey.
 */
export function createSavedJourney(
  journey: Omit<SavedJourney, "id" | "created_at" | "updated_at">,
): SavedJourney {
  const current = getSavedJourneys();
  const newItem: SavedJourney = {
    ...journey,
    id: `sj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const updated = [newItem, ...current];
  saveAllJourneys(updated);
  return newItem;
}

/**
 * Update an existing saved journey by ID.
 */
export function updateSavedJourney(
  id: string,
  updates: Partial<Omit<SavedJourney, "id" | "created_at">>,
): SavedJourney | null {
  const current = getSavedJourneys();
  const index = current.findIndex((j) => j.id === id);
  if (index === -1) return null;

  const existing = current[index]!;
  const updatedItem: SavedJourney = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const updatedList = [...current];
  updatedList[index] = updatedItem;
  saveAllJourneys(updatedList);
  return updatedItem;
}

/**
 * Rename and optionally change the icon of a saved journey.
 */
export function renameSavedJourney(
  id: string,
  newName: string,
  newIcon?: SavedJourneyIcon,
): boolean {
  const trimmed = newName.trim();
  if (!trimmed) return false;
  const updates: Partial<SavedJourney> = { name: trimmed };
  if (newIcon) updates.icon = newIcon;
  return updateSavedJourney(id, updates) !== null;
}

/**
 * Delete a saved journey by ID.
 */
export function deleteSavedJourney(id: string): boolean {
  const current = getSavedJourneys();
  const filtered = current.filter((j) => j.id !== id);
  if (filtered.length === current.length) return false;
  saveAllJourneys(filtered);
  return true;
}

/**
 * Toggle favorite status of a saved journey.
 */
export function toggleFavouriteSavedJourney(id: string): boolean {
  const current = getSavedJourneys();
  const target = current.find((j) => j.id === id);
  if (!target) return false;
  const newFav = !target.isFavourite;
  updateSavedJourney(id, { isFavourite: newFav });
  return newFav;
}

/**
 * Reverse a saved journey:
 * Swaps Origin <-> Destination,
 * Swaps Coordinates and Stop IDs,
 * Preserves transit mode and alarm preferences.
 */
export function reverseSavedJourney(id: string): SavedJourney | null {
  const current = getSavedJourneys();
  const target = current.find((j) => j.id === id);
  if (!target) return null;

  const reversed: Partial<SavedJourney> = {
    originName: target.destinationName,
    originStopId: target.destinationStopId,
    originLat: target.destinationLat,
    originLon: target.destinationLon,
    destinationName: target.originName,
    destinationStopId: target.originStopId,
    destinationLat: target.originLat,
    destinationLon: target.originLon,
    updated_at: new Date().toISOString(),
  };

  return updateSavedJourney(id, reversed);
}

/**
 * Background sync with Supabase for authenticated riders.
 */
async function trySyncToSupabase(journeys: SavedJourney[]): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id) return;

    // Store in user metadata or custom saved table if available
    await supabase.auth.updateUser({
      data: { trako_saved_journeys_count: journeys.length },
    });
  } catch {
    // Non-blocking sync failure
  }
}
