import type { OfficeLocation } from "@/types";
import { resolvePunchPlaceLabel } from "@/lib/location/punch-label";

type PunchSide = {
  latitude: number | null;
  longitude: number | null;
  distanceMeters: number | null;
  ip: string | null;
  locationName?: string | null;
  label: string;
  locations?: OfficeLocation[];
};

function PunchSideCard({
  latitude,
  longitude,
  distanceMeters,
  ip,
  locationName,
  label,
  locations = [],
}: PunchSide) {
  const place = resolvePunchPlaceLabel({
    locationName,
    latitude,
    longitude,
    distanceMeters,
    ip,
    locations,
  });

  const isWifi = place === "Office Wi‑Fi";

  return (
    <div className="min-w-[8.5rem] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      {place ? (
        <p
          className={
            isWifi
              ? "mt-1 text-xs font-medium text-slate-600"
              : "mt-1 text-xs font-semibold text-slate-900"
          }
          title={place}
        >
          {place}
        </p>
      ) : (
        <p className="mt-1 text-xs text-slate-400">—</p>
      )}
    </div>
  );
}

export function PunchLocationCell({
  checkInLatitude,
  checkInLongitude,
  checkInDistanceMeters,
  checkInIp,
  checkInLocationName,
  checkOutLatitude,
  checkOutLongitude,
  checkOutDistanceMeters,
  checkOutIp,
  checkOutLocationName,
  locations = [],
}: {
  checkInLatitude: number | null;
  checkInLongitude: number | null;
  checkInAccuracy?: number | null;
  checkInDistanceMeters: number | null;
  checkInIp: string | null;
  checkInLocationName?: string | null;
  checkOutLatitude: number | null;
  checkOutLongitude: number | null;
  checkOutAccuracy?: number | null;
  checkOutDistanceMeters: number | null;
  checkOutIp: string | null;
  checkOutLocationName?: string | null;
  locations?: OfficeLocation[];
}) {
  return (
    <div className="flex min-w-[18rem] gap-2">
      <PunchSideCard
        label="In"
        latitude={checkInLatitude}
        longitude={checkInLongitude}
        distanceMeters={checkInDistanceMeters}
        ip={checkInIp}
        locationName={checkInLocationName}
        locations={locations}
      />
      <PunchSideCard
        label="Out"
        latitude={checkOutLatitude}
        longitude={checkOutLongitude}
        distanceMeters={checkOutDistanceMeters}
        ip={checkOutIp}
        locationName={checkOutLocationName}
        locations={locations}
      />
    </div>
  );
}
