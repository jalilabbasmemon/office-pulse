import type { OfficeLocation } from "@/types";
import { calculateDistanceMeters } from "@/lib/location/haversine";

const WIFI_LABEL = "Office Wi‑Fi";

/** Resolve display label: branch name, or Office Wi‑Fi. Never "GPS punch". */
export function resolvePunchPlaceLabel(input: {
  locationName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceMeters?: number | null;
  ip?: string | null;
  locations?: OfficeLocation[];
}): string | null {
  const stored = input.locationName?.trim() || null;
  if (stored) {
    if (/^office\s*wi[‑-]?fi$/i.test(stored) || /^wifi$/i.test(stored)) {
      return WIFI_LABEL;
    }
    return stored;
  }

  const hasCoords =
    input.latitude != null &&
    input.longitude != null &&
    Number.isFinite(input.latitude) &&
    Number.isFinite(input.longitude);

  if (hasCoords && input.locations && input.locations.length > 0) {
    let nearestInRadius: { name: string; distance: number } | null = null;
    let nearestAny: { name: string; distance: number } | null = null;

    for (const loc of input.locations) {
      if (loc.is_active === false) continue;
      const distance = calculateDistanceMeters(
        input.latitude!,
        input.longitude!,
        loc.latitude,
        loc.longitude
      );
      if (!nearestAny || distance < nearestAny.distance) {
        nearestAny = { name: loc.name, distance };
      }
      if (distance <= loc.allowed_radius_meters) {
        if (!nearestInRadius || distance < nearestInRadius.distance) {
          nearestInRadius = { name: loc.name, distance };
        }
      }
    }

    if (nearestInRadius) return nearestInRadius.name;
    if (nearestAny) return nearestAny.name;
  }

  // Wi‑Fi-only punch: IP present, no GPS
  if (!hasCoords && input.ip) {
    return WIFI_LABEL;
  }

  if (hasCoords) return "Office";

  return null;
}

export { WIFI_LABEL };
