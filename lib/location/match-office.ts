import type { GpsPayload, OfficeLocation } from "@/types";
import { calculateDistanceMeters } from "@/lib/location/haversine";

/** Nearest active branch within its radius + accuracy, or null. */
export function matchOfficeLocation(
  gps: GpsPayload,
  locations: OfficeLocation[],
  maxAccuracyMeters: number
): { location: OfficeLocation; distanceMeters: number } | null {
  if (
    typeof gps.accuracy !== "number" ||
    Number.isNaN(gps.accuracy) ||
    gps.accuracy > maxAccuracyMeters
  ) {
    return null;
  }

  let best: { location: OfficeLocation; distanceMeters: number } | null = null;

  for (const loc of locations) {
    if (!loc.is_active) continue;
    const distanceMeters = calculateDistanceMeters(
      gps.latitude,
      gps.longitude,
      loc.latitude,
      loc.longitude
    );
    if (distanceMeters > loc.allowed_radius_meters) continue;
    if (!best || distanceMeters < best.distanceMeters) {
      best = { location: loc, distanceMeters };
    }
  }

  return best;
}
