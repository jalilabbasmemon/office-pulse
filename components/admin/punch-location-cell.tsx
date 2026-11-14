type PunchCoords = {
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

function PunchBlock({
  latitude,
  longitude,
  accuracy,
  distanceMeters,
  ip,
  locationName,
  label,
}: PunchCoords) {
  const hasCoords =
    latitude != null &&
    longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  if (!hasCoords && !ip && !locationName) {
    return (
      <p className="text-xs text-slate-400">
        {label}: —
      </p>
    );
  }

  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      {locationName ? (
        <p className="text-xs font-medium text-slate-800">{locationName}</p>
      ) : null}
      {hasCoords ? (
        <a
          href={mapUrl(latitude, longitude)}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-teal-700 hover:underline"
          title="Open in OpenStreetMap"
        >
          {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </a>
      ) : (
        <p className="text-xs text-slate-500">Wi‑Fi only (no GPS stored)</p>
      )}
      <p className="text-[11px] text-slate-500">
        {distanceMeters != null ? `${Math.round(distanceMeters)}m from office` : "Distance n/a"}
        {accuracy != null ? ` · ±${Math.round(accuracy)}m` : ""}
      </p>
      {ip ? (
        <p className="font-mono text-[11px] text-slate-500">IP {ip}</p>
      ) : null}
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
    <div className="min-w-[11rem] space-y-2">
      <PunchBlock
        label="Check-in"
        latitude={checkInLatitude}
        longitude={checkInLongitude}
        accuracy={checkInAccuracy}
        distanceMeters={checkInDistanceMeters}
        ip={checkInIp}
        locationName={checkInLocationName}
      />
      <PunchBlock
        label="Check-out"
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
