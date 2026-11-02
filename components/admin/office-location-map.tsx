"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker, Circle, LeafletMouseEvent } from "leaflet";

type Props = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  onChange: (lat: number, lng: number) => void;
};

export function OfficeLocationMap({
  latitude,
  longitude,
  radiusMeters,
  onChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const circleRef = useRef<Circle | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      // Leaflet CSS (bundled with package)
      await import("leaflet/dist/leaflet.css");

      if (cancelled || !containerRef.current || mapRef.current) return;

      // Fix default marker icons under bundlers
      const icon = L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([latitude, longitude], 17);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const marker = L.marker([latitude, longitude], {
        draggable: true,
        icon,
      }).addTo(map);

      const circle = L.circle([latitude, longitude], {
        radius: Math.max(1, radiusMeters || 1),
        color: "#0f766e",
        fillColor: "#14b8a6",
        fillOpacity: 0.18,
        weight: 2,
      }).addTo(map);

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        onChangeRef.current(
          Number(pos.lat.toFixed(6)),
          Number(pos.lng.toFixed(6))
        );
      });

      map.on("click", (e: LeafletMouseEvent) => {
        onChangeRef.current(
          Number(e.latlng.lat.toFixed(6)),
          Number(e.latlng.lng.toFixed(6))
        );
      });

      mapRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;

      // Leaflet needs a tick after layout to size correctly
      requestAnimationFrame(() => map.invalidateSize());
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
      }
    };
    // Init once; position updates handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    const circle = circleRef.current;
    if (!map || !marker || !circle) return;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const next = { lat: latitude, lng: longitude };
    marker.setLatLng(next);
    circle.setLatLng(next);
    circle.setRadius(Math.max(1, radiusMeters || 1));
    map.panTo(next);
  }, [latitude, longitude, radiusMeters]);

  const osmLink = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`;

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="h-64 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 z-0"
        aria-label="Office location map"
      />
      <p className="text-xs text-slate-500">
        Tap the map or drag the pin to set the office. Teal circle = allowed
        punch radius.{" "}
        <a
          href={osmLink}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-teal-700 hover:underline"
        >
          Open larger map
        </a>
      </p>
    </div>
  );
}
