type PunchSide = {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  distanceMeters: number | null;
  ip: string | null;
  locationName?: string | null;
  label: string;
};

function mapUrl(lat: number, lng: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}

function formatDistance(meters: number | null) {
  if (meters == null || Number.isNaN(meters)) return null;
  return `${Math.round(meters)}m`;
}

function PunchSideCard({
  latitude,
  longitude,
  accuracy,
  distanceMeters,
  ip,
  locationName,
  label,
}: PunchSide) {
  const hasCoords =
    latitude != null &&
    longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  const empty = !hasCoords && !ip && !locationName;
  const distance = formatDistance(distanceMeters);

  return (
    <div className="min-w-[9.5rem] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </p>
        {distance ? (
          <span className="rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-800">
            {distance}
          </span>
        ) : null}
      </div>

      {empty ? (
        <p className="mt-1 text-xs text-slate-400">—</p>
      ) : (
        <div className="mt-1 space-y-0.5">
          <p className="truncate text-xs font-medium text-slate-800">
            {locationName || (hasCoords ? "GPS punch" : "Office Wi‑Fi")}
          </p>
          {hasCoords ? (
            <a
              href={mapUrl(latitude, longitude)}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-[11px] font-medium text-teal-700 hover:underline"
              title={`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`}
            >
              View map
              {accuracy != null ? ` · ±${Math.round(accuracy)}m` : ""}
            </a>
          ) : (
            <p className="text-[11px] text-slate-500">No GPS stored</p>
          )}
          {ip ? (
            <p className="truncate font-mono text-[10px] text-slate-400" title={ip}>
              {ip}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function PunchLocationCell({
  checkInLatitude,
  checkInLongitude,
  checkInAccuracy,
  checkInDistanceMeters,
  checkInIp,
  checkInLocationName,
  checkOutLatitude,
  checkOutLongitude,
  checkOutAccuracy,
  checkOutDistanceMeters,
  checkOutIp,
  checkOutLocationName,
}: {
  checkInLatitude: number | null;
  checkInLongitude: number | null;
  checkInAccuracy: number | null;
  checkInDistanceMeters: number | null;
  checkInIp: string | null;
  checkInLocationName?: string | null;
  checkOutLatitude: number | null;
  checkOutLongitude: number | null;
  checkOutAccuracy: number | null;
  checkOutDistanceMeters: number | null;
  checkOutIp: string | null;
  checkOutLocationName?: string | null;
}) {
  return (
    <div className="flex min-w-[20rem] gap-2">
      <PunchSideCard
        label="In"
        latitude={checkInLatitude}
        longitude={checkInLongitude}
        accuracy={checkInAccuracy}
        distanceMeters={checkInDistanceMeters}
        ip={checkInIp}
        locationName={checkInLocationName}
      />
      <PunchSideCard
        label="Out"
        latitude={checkOutLatitude}
        longitude={checkOutLongitude}
        accuracy={checkOutAccuracy}
        distanceMeters={checkOutDistanceMeters}
        ip={checkOutIp}
        locationName={checkOutLocationName}
      />
    </div>
  );
}
