/**
 * Live GPS acquisition for browsers.
 *
 * Windows laptops often return IP / "default location" (city-level, e.g.
 * Islamabad) with accuracy of several km. A single getCurrentPosition can
 * accept that coarse fix immediately. We watch for a short window, keep the
 * best reading, and reject city-level / stale network locations.
 */

export type LiveGpsReading = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

export type LiveGpsErrorCode =
  | "UNSUPPORTED"
  | "PERMISSION_DENIED"
  | "UNAVAILABLE"
  | "TIMEOUT"
  | "COARSE_ONLY";

export class LiveGpsError extends Error {
  code: LiveGpsErrorCode;

  constructor(code: LiveGpsErrorCode, message: string) {
    super(message);
    this.name = "LiveGpsError";
    this.code = code;
  }
}

/** Accuracy worse than this is almost always IP / Windows default location. */
export const COARSE_LOCATION_METERS = 500;

const DEFAULT_WATCH_MS = 12000;
const DEFAULT_ACCEPT_ACCURACY_M = 100;

export type AcquireLiveGpsOptions = {
  /** Stop early once accuracy is at or below this (meters). */
  acceptAccuracyMeters?: number;
  /** How long to watch for a better fix. */
  watchMs?: number;
  /**
   * If true (default), reject when the best fix is still coarse
   * (IP / default-location style). Set false for punch UI that already
   * enforces office max_gps_accuracy_meters.
   */
  rejectCoarse?: boolean;
  /** Max accuracy allowed when rejectCoarse is true. */
  maxAcceptableAccuracyMeters?: number;
  onProgress?: (reading: LiveGpsReading) => void;
};

function isIosUa() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function mapGeoError(err: GeolocationPositionError): LiveGpsError {
  const ios = isIosUa();
  if (err.code === err.PERMISSION_DENIED) {
    return new LiveGpsError(
      "PERMISSION_DENIED",
      ios
        ? "Location is blocked. On iPhone: Settings → Privacy & Security → Location Services → Safari Websites (or OfficePulse) → While Using the App. Also allow Precise Location."
        : "Location access is required. Allow location for this site in the browser, and turn on Windows Location services."
    );
  }
  if (err.code === err.TIMEOUT) {
    return new LiveGpsError(
      "TIMEOUT",
      ios
        ? "Timed out waiting for GPS. Go outdoors or near a window, ensure Location is On, then tap Refresh location."
        : "Timed out waiting for GPS. Move near a window, enable high-accuracy location in Windows, or set the pin on the map / use a phone."
    );
  }
  return new LiveGpsError(
    "UNAVAILABLE",
    ios
      ? "Could not read GPS. Open this site in Safari (not Chrome/WhatsApp), allow Location, and try again."
      : "Could not read live GPS. This PC may only have IP/network location (often a city like Islamabad). Use a phone, or place the office pin on the map manually."
  );
}

/**
 * Watch the device location briefly and return the most accurate reading.
 * Prefers real GPS over cached / IP geolocation.
 */
export function acquireLiveGps(
  options: AcquireLiveGpsOptions = {}
): Promise<LiveGpsReading> {
  const {
    acceptAccuracyMeters = DEFAULT_ACCEPT_ACCURACY_M,
    watchMs = DEFAULT_WATCH_MS,
    rejectCoarse = true,
    maxAcceptableAccuracyMeters = COARSE_LOCATION_METERS,
    onProgress,
  } = options;

  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(
        new LiveGpsError(
          "UNSUPPORTED",
          "Geolocation is not supported on this device."
        )
      );
      return;
    }

    let best: LiveGpsReading | null = null;
    let settled = false;
    let watchId: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      if (timer != null) clearTimeout(timer);
      fn();
    };

    const consider = (pos: GeolocationPosition) => {
      const reading: LiveGpsReading = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
      if (!best || reading.accuracy < best.accuracy) {
        best = reading;
        onProgress?.(reading);
      }
      if (best.accuracy <= acceptAccuracyMeters) {
        finish(() => resolve(best!));
      }
    };

    const geoOpts: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: watchMs,
    };

    watchId = navigator.geolocation.watchPosition(
      consider,
      (err) => {
        // Keep waiting if we already have a sample; otherwise fail.
        if (best) return;
        finish(() => reject(mapGeoError(err)));
      },
      geoOpts
    );

    // Also kick a one-shot in case watch is slow to fire.
    navigator.geolocation.getCurrentPosition(consider, () => undefined, geoOpts);

    timer = setTimeout(() => {
      finish(() => {
        const ios = isIosUa();
        if (!best) {
          reject(
            new LiveGpsError(
              "TIMEOUT",
              ios
                ? "No GPS fix yet. Use Safari, turn on Location Services, allow Precise Location, then tap Refresh location outdoors or near a window."
                : "No live GPS fix yet. Enable Windows Location (Settings → Privacy → Location), use a phone with GPS, or set the office pin on the map."
            )
          );
          return;
        }
        if (rejectCoarse && best.accuracy > maxAcceptableAccuracyMeters) {
          reject(
            new LiveGpsError(
              "COARSE_ONLY",
              ios
                ? `GPS accuracy is too weak (~${Math.round(best.accuracy)}m). Enable Precise Location for Safari/OfficePulse and try outdoors.`
                : `Only a coarse/network location was available (~${Math.round(best.accuracy)}m). That is usually the PC’s default or IP city (e.g. Islamabad), not live GPS. Place the pin on the map, or use a phone outdoors with Location on.`
            )
          );
          return;
        }
        resolve(best);
      });
    }, watchMs);
  });
}
