"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  acquireLiveGps,
  LiveGpsError,
} from "@/lib/location/live-gps";
import type { OfficeLocation, OfficeSettings } from "@/types";

const OfficeLocationMap = dynamic(
  () =>
    import("@/components/admin/office-location-map").then(
      (m) => m.OfficeLocationMap
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-sm text-slate-500">
        Loading map…
      </div>
    ),
  }
);

type LocDraft = {
  id?: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  allowed_radius_meters: number;
  /** Comma-separated public IPs for this branch’s Wi‑Fi. */
  allowed_public_ips: string;
  is_active: boolean;
};

function toDraft(loc: OfficeLocation): LocDraft {
  return {
    id: loc.id,
    name: loc.name,
    address: loc.address ?? "",
    latitude: loc.latitude,
    longitude: loc.longitude,
    allowed_radius_meters: loc.allowed_radius_meters,
    allowed_public_ips: (loc.allowed_public_ips ?? []).join(", "),
    is_active: loc.is_active,
  };
}

function defaultLocation(name = "HQ"): LocDraft {
  return {
    name,
    address: "",
    latitude: 24.8607,
    longitude: 67.0011,
    allowed_radius_meters: 150,
    allowed_public_ips: "",
    is_active: true,
  };
}

function parseIpList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function OfficeSettingsForm({
  settings,
  locations: locationsProp = [],
  readOnly = false,
}: {
  settings: OfficeSettings | null;
  locations?: OfficeLocation[];
  readOnly?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [gpsPending, setGpsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detectedIp, setDetectedIp] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showCoords, setShowCoords] = useState(false);

  const seededLocations: LocDraft[] =
    locationsProp.length > 0
      ? locationsProp.map(toDraft)
      : settings
        ? [
            {
              name: settings.office_name || "HQ",
              address: settings.address ?? "",
              latitude: settings.latitude,
              longitude: settings.longitude,
              allowed_radius_meters: settings.allowed_radius_meters,
              allowed_public_ips: settings.office_public_ip ?? "",
              is_active: true,
              id: undefined,
            },
          ]
        : [defaultLocation()];

  const [locations, setLocations] = useState<LocDraft[]>(seededLocations);
  const [form, setForm] = useState({
    office_name: settings?.office_name ?? "Main Office",
    office_public_ip: settings?.office_public_ip ?? "",
    allowed_office_ips: (settings?.allowed_office_ips ?? []).join(", "),
    max_gps_accuracy_meters: settings?.max_gps_accuracy_meters ?? 100,
    allow_wifi_only_punch: settings?.allow_wifi_only_punch ?? true,
    timezone: settings?.timezone ?? "Asia/Karachi",
  });

  useEffect(() => {
    fetch(`/api/network/my-ip?ts=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ip) setDetectedIp(d.ip);
      })
      .catch(() => undefined);
  }, []);

  function updateForm<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateLoc<K extends keyof LocDraft>(
    index: number,
    key: K,
    value: LocDraft[K]
  ) {
    setLocations((prev) =>
      prev.map((loc, i) => (i === index ? { ...loc, [key]: value } : loc))
    );
  }

  const active = locations[activeIndex] ?? locations[0];

  async function useCurrentLocation() {
    if (!active) return;
    setError(null);
    setMessage("Waiting for live GPS…");
    setGpsPending(true);
    try {
      const reading = await acquireLiveGps({
        acceptAccuracyMeters: 50,
        watchMs: 15000,
        rejectCoarse: true,
        maxAcceptableAccuracyMeters: 500,
        onProgress: (r) => {
          setMessage(
            `Improving GPS… best so far ~${Math.round(r.accuracy)}m. Stay still.`
          );
        },
      });
      updateLoc(activeIndex, "latitude", Number(reading.latitude.toFixed(6)));
      updateLoc(activeIndex, "longitude", Number(reading.longitude.toFixed(6)));
      setMessage(
        `Pin moved to live GPS (~${Math.round(reading.accuracy)}m). Confirm the building, then save.`
      );
    } catch (e) {
      setError(
        e instanceof LiveGpsError
          ? e.message
          : "Could not read live GPS location."
      );
      setMessage(null);
    } finally {
      setGpsPending(false);
    }
  }

  function useDetectedIpForLocation() {
    if (!detectedIp || detectedIp === "0.0.0.0") {
      setError("Could not detect your public IP yet. Refresh and try again.");
      return;
    }
    const current = locations[activeIndex]?.allowed_public_ips ?? "";
    const existing = parseIpList(current);
    if (!existing.includes(detectedIp)) {
      existing.push(detectedIp);
    }
    updateLoc(activeIndex, "allowed_public_ips", existing.join(", "));
    setMessage(
      `Added ${detectedIp} to ${locations[activeIndex]?.name || "this location"}. Save while on that branch Wi‑Fi.`
    );
  }

  function addLocation() {
    setLocations((prev) => [
      ...prev,
      defaultLocation(`Branch ${prev.length + 1}`),
    ]);
    setActiveIndex(locations.length);
  }

  function removeLocation(index: number) {
    if (locations.length <= 1) {
      setError("Keep at least one office location.");
      return;
    }
    setLocations((prev) => prev.filter((_, i) => i !== index));
    setActiveIndex((i) => Math.max(0, Math.min(i, locations.length - 2)));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const payload = {
        office_name: form.office_name,
        address: active?.address || null,
        latitude: active?.latitude,
        longitude: active?.longitude,
        allowed_radius_meters: active?.allowed_radius_meters,
        office_public_ip: form.office_public_ip || null,
        allowed_office_ips: form.allowed_office_ips
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        max_gps_accuracy_meters: Number(form.max_gps_accuracy_meters),
        allow_wifi_only_punch: Boolean(form.allow_wifi_only_punch),
        timezone: form.timezone,
        locations: locations.map((loc, i) => ({
          id: loc.id,
          name: loc.name,
          address: loc.address || null,
          latitude: Number(loc.latitude),
          longitude: Number(loc.longitude),
          allowed_radius_meters: Number(loc.allowed_radius_meters),
          allowed_public_ips: parseIpList(loc.allowed_public_ips),
          is_active: loc.is_active,
          sort_order: i,
        })),
      };
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Save failed");
        return;
      }
      if (Array.isArray(data.locations)) {
        setLocations(data.locations.map(toDraft));
      }
      setMessage("Office settings saved.");
    });
  }

  if (!active) return null;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {readOnly ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          View-only account — settings cannot be changed.
        </p>
      ) : null}

      <fieldset disabled={readOnly} className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          <p className="font-medium text-slate-800">How punch checks work</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            <li>
              <strong>Branch Wi‑Fi</strong> (that location’s public IP) → GPS
              not required; punch is labeled with that location.
            </li>
            <li>
              <strong>Any other network</strong> → must be inside one HQ /
              branch GPS radius.
            </li>
          </ul>
          <p className="mt-2">
            Your current public IP:{" "}
            <span className="font-mono font-semibold text-slate-900">
              {detectedIp ?? "detecting…"}
            </span>
          </p>
        </div>

        <div>
          <Label htmlFor="office_name">Organization name</Label>
          <Input
            id="office_name"
            required
            value={form.office_name}
            onChange={(e) => updateForm("office_name", e.target.value)}
          />
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-slate-900">
                Office locations
              </p>
              <p className="text-xs text-slate-500">
                Add HQ and every branch. Each has its own pin, radius, and
                public Wi‑Fi IP(s).
              </p>
            </div>
            {!readOnly ? (
              <Button type="button" variant="outline" size="sm" onClick={addLocation}>
                Add location
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {locations.map((loc, i) => (
              <button
                key={loc.id ?? `new-${i}`}
                type="button"
                onClick={() => setActiveIndex(i)}
                className={
                  i === activeIndex
                    ? "rounded-full bg-teal-700 px-3 py-1 text-xs font-medium text-white"
                    : "rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                }
              >
                {loc.name || `Location ${i + 1}`}
                {!loc.is_active ? " (off)" : ""}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="loc_name">Location name</Label>
              <Input
                id="loc_name"
                required
                value={active.name}
                onChange={(e) => updateLoc(activeIndex, "name", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="loc_radius">Radius (m)</Label>
              <Input
                id="loc_radius"
                type="number"
                required
                value={active.allowed_radius_meters}
                onChange={(e) =>
                  updateLoc(
                    activeIndex,
                    "allowed_radius_meters",
                    Number(e.target.value)
                  )
                }
              />
            </div>
          </div>
          <div>
            <Label htmlFor="loc_address">Address (optional)</Label>
            <Input
              id="loc_address"
              value={active.address}
              onChange={(e) => updateLoc(activeIndex, "address", e.target.value)}
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <Label htmlFor="loc_ips" className="mb-0">
                Public Wi‑Fi IP(s) for this location
              </Label>
              <button
                type="button"
                className="text-xs font-medium text-teal-700 hover:underline"
                onClick={useDetectedIpForLocation}
              >
                Use my current IP
              </button>
            </div>
            <Input
              id="loc_ips"
              placeholder="e.g. 203.0.113.10, 203.0.113.11"
              value={active.allowed_public_ips}
              onChange={(e) =>
                updateLoc(activeIndex, "allowed_public_ips", e.target.value)
              }
            />
            <p className="mt-1 text-xs text-slate-500">
              Comma-separated. Connect to this branch’s Wi‑Fi, then click “Use my
              current IP”. Location A and Location B can have different IPs.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="accent-teal-700"
              checked={active.is_active}
              onChange={(e) =>
                updateLoc(activeIndex, "is_active", e.target.checked)
              }
            />
            Active (used for GPS punch)
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              Drag the pin or use GPS. Laptops often show a city default — drag
              if needed.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={gpsPending || readOnly}
              onClick={() => void useCurrentLocation()}
            >
              {gpsPending ? "Reading live GPS…" : "Use my GPS"}
            </Button>
          </div>

          <OfficeLocationMap
            latitude={Number(active.latitude)}
            longitude={Number(active.longitude)}
            radiusMeters={Number(active.allowed_radius_meters) || 150}
            onChange={(lat, lng) => {
              updateLoc(activeIndex, "latitude", lat);
              updateLoc(activeIndex, "longitude", lng);
              setMessage("Map pin updated. Save settings when ready.");
            }}
          />

          <button
            type="button"
            className="text-xs font-medium text-teal-700 hover:underline"
            onClick={() => setShowCoords((v) => !v)}
          >
            {showCoords ? "Hide coordinates" : "Show coordinates"}
          </button>
          {showCoords && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  required
                  value={active.latitude}
                  onChange={(e) =>
                    updateLoc(activeIndex, "latitude", Number(e.target.value))
                  }
                />
              </div>
              <div>
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  required
                  value={active.longitude}
                  onChange={(e) =>
                    updateLoc(activeIndex, "longitude", Number(e.target.value))
                  }
                />
              </div>
            </div>
          )}

          {!readOnly && locations.length > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => removeLocation(activeIndex)}
            >
              Remove this location
            </Button>
          ) : null}
        </div>

        <div>
          <Label htmlFor="accuracy">Max GPS accuracy (m)</Label>
          <Input
            id="accuracy"
            type="number"
            required
            value={form.max_gps_accuracy_meters}
            onChange={(e) =>
              updateForm("max_gps_accuracy_meters", Number(e.target.value))
            }
          />
          <p className="mt-1 text-xs text-slate-500">
            Applies when punching off office Wi‑Fi (phones usually 5–50m).
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-teal-700"
            checked={form.allow_wifi_only_punch}
            onChange={(e) =>
              updateForm("allow_wifi_only_punch", e.target.checked)
            }
          />
          <span>
            <span className="block text-sm font-medium text-slate-900">
              On office Wi‑Fi, skip GPS
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Recommended for Windows office PCs. Off Wi‑Fi, GPS must still match
              a branch.
            </span>
          </span>
        </label>

        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 space-y-3">
          <p className="text-sm font-medium text-slate-800">
            Shared / legacy org IPs (optional)
          </p>
          <p className="text-xs text-slate-500">
            Prefer setting IPs on each location above. These org-wide IPs still
            work as a fallback for any branch (punch labeled “Office Wi‑Fi”).
          </p>
          <div>
            <Label htmlFor="ip">Primary shared public IP</Label>
            <Input
              id="ip"
              placeholder="123.123.123.123"
              value={form.office_public_ip}
              onChange={(e) => updateForm("office_public_ip", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ips">Additional shared IPs (comma-separated)</Label>
            <Input
              id="ips"
              value={form.allowed_office_ips}
              onChange={(e) => updateForm("allowed_office_ips", e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="timezone">Timezone</Label>
          <Input
            id="timezone"
            value={form.timezone}
            onChange={(e) => updateForm("timezone", e.target.value)}
          />
        </div>
      </fieldset>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {message}
        </p>
      )}
      {!readOnly ? (
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      ) : null}
    </form>
  );
}
