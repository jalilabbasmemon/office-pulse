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
import type { OfficeSettings } from "@/types";

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

export function OfficeSettingsForm({
  settings,
}: {
  settings: OfficeSettings | null;
}) {
  const [pending, startTransition] = useTransition();
  const [gpsPending, setGpsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detectedIp, setDetectedIp] = useState<string | null>(null);
  const [showCoords, setShowCoords] = useState(false);
  const [form, setForm] = useState({
    office_name: settings?.office_name ?? "Main Office",
    address: settings?.address ?? "",
    latitude: settings?.latitude ?? 24.8607,
    longitude: settings?.longitude ?? 67.0011,
    allowed_radius_meters: settings?.allowed_radius_meters ?? 150,
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

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function useCurrentLocation() {
    setError(null);
    setMessage("Waiting for live GPS (not IP/city default)…");
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
      update("latitude", Number(reading.latitude.toFixed(6)));
      update("longitude", Number(reading.longitude.toFixed(6)));
      setMessage(
        `Pin moved to live GPS (~${Math.round(reading.accuracy)}m accuracy). Confirm the building on the map, then save.`
      );
    } catch (e) {
      const msg =
        e instanceof LiveGpsError
          ? e.message
          : "Could not read live GPS location.";
      setError(msg);
      setMessage(null);
    } finally {
      setGpsPending(false);
    }
  }

  function useDetectedIp() {
    if (!detectedIp || detectedIp === "0.0.0.0") {
      setError("Could not detect your public IP yet. Refresh and try again.");
      return;
    }
    update("office_public_ip", detectedIp);
    setMessage(
      `Filled office public IP: ${detectedIp}. Make sure you are on office Wi‑Fi before saving.`
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const payload = {
        office_name: form.office_name,
        address: form.address || null,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        allowed_radius_meters: Number(form.allowed_radius_meters),
        office_public_ip: form.office_public_ip || null,
        allowed_office_ips: form.allowed_office_ips
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        max_gps_accuracy_meters: Number(form.max_gps_accuracy_meters),
        allow_wifi_only_punch: Boolean(form.allow_wifi_only_punch),
        timezone: form.timezone,
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
      setMessage("Office settings saved.");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        <p className="font-medium text-slate-800">How network checks work</p>
        <p className="mt-1">
          Browsers cannot read Wi‑Fi name (SSID). Instead, when someone punches,
          the server compares their <strong>public IP</strong> to the office
          public IP below. Connect a phone/PC to office Wi‑Fi, detect the IP,
          then save it.
        </p>
        <p className="mt-2">
          Your current public IP:{" "}
          <span className="font-mono font-semibold text-slate-900">
            {detectedIp ?? "detecting…"}
          </span>
        </p>
      </div>

      <div>
        <Label htmlFor="office_name">Office name</Label>
        <Input
          id="office_name"
          required
          value={form.office_name}
          onChange={(e) => update("office_name", e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          value={form.address}
          onChange={(e) => update("address", e.target.value)}
        />
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-slate-900">Office on map</p>
            <p className="text-xs text-slate-500">
              Confirm the pin matches your office building (OpenStreetMap — no
              Google key). Laptops often return a city default (e.g. Islamabad)
              via IP — drag the pin if GPS is coarse.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={gpsPending}
            onClick={() => void useCurrentLocation()}
          >
            {gpsPending ? "Reading live GPS…" : "Use my GPS"}
          </Button>
        </div>

        <OfficeLocationMap
          latitude={Number(form.latitude)}
          longitude={Number(form.longitude)}
          radiusMeters={Number(form.allowed_radius_meters) || 150}
          onChange={(lat, lng) => {
            update("latitude", lat);
            update("longitude", lng);
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
                value={form.latitude}
                onChange={(e) => update("latitude", Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                required
                value={form.longitude}
                onChange={(e) => update("longitude", Number(e.target.value))}
              />
            </div>
          </div>
        )}
        {/* Keep values in the form for submit even when coords UI is hidden */}
        {!showCoords && (
          <>
            <input type="hidden" name="latitude" value={form.latitude} readOnly />
            <input type="hidden" name="longitude" value={form.longitude} readOnly />
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="radius">Allowed radius (m)</Label>
          <Input
            id="radius"
            type="number"
            required
            value={form.allowed_radius_meters}
            onChange={(e) =>
              update("allowed_radius_meters", Number(e.target.value))
            }
          />
          <p className="mt-1 text-xs text-slate-500">
            Shown as the teal circle on the map.
          </p>
        </div>
        <div>
          <Label htmlFor="accuracy">Max GPS accuracy (m)</Label>
          <Input
            id="accuracy"
            type="number"
            required
            value={form.max_gps_accuracy_meters}
            onChange={(e) =>
              update("max_gps_accuracy_meters", Number(e.target.value))
            }
          />
          <p className="mt-1 text-xs text-slate-500">
            Phones are usually 5–50m. Desktop browsers often report a city
            (e.g. Islamabad) — keep Wi‑Fi-only punch on for office laptops.
          </p>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-teal-700"
          checked={form.allow_wifi_only_punch}
          onChange={(e) => update("allow_wifi_only_punch", e.target.checked)}
        />
        <span>
          <span className="block text-sm font-medium text-slate-900">
            Allow punch on office Wi‑Fi without GPS
          </span>
          <span className="mt-0.5 block text-xs text-slate-500">
            Recommended for Windows office PCs. When the public IP matches,
            check-in/out works even if the browser shows the wrong city.
            Phones with good GPS still use the map radius when available.
          </span>
        </span>
      </label>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <Label htmlFor="ip" className="mb-0">
            Office public IP
          </Label>
          <button
            type="button"
            className="text-xs font-medium text-teal-700 hover:underline"
            onClick={useDetectedIp}
          >
            Use my current IP
          </button>
        </div>
        <Input
          id="ip"
          placeholder="123.123.123.123"
          value={form.office_public_ip}
          onChange={(e) => update("office_public_ip", e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="ips">Additional allowed IPs (comma-separated)</Label>
        <Input
          id="ips"
          value={form.allowed_office_ips}
          onChange={(e) => update("allowed_office_ips", e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="timezone">Timezone</Label>
        <Input
          id="timezone"
          value={form.timezone}
          onChange={(e) => update("timezone", e.target.value)}
        />
      </div>
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
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
