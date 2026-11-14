"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatDate, formatMinutes, formatTime } from "@/lib/utils";
import {
  formatShiftClock,
  greetingForNow,
  isEarlyLeave,
  minutesUntilShiftEnd,
} from "@/lib/attendance/timezone";
import { matchOfficeLocation } from "@/lib/location/match-office";
import {
  acquireLiveGps,
  LiveGpsError,
} from "@/lib/location/live-gps";
import { isIosDevice, isIosSafari } from "@/lib/platform/ios";
import type {
  Attendance,
  Employee,
  OfficeLocation,
  OfficeSettings,
} from "@/types";

type Props = {
  employee: Employee;
  today: Attendance | null;
  office: OfficeSettings | null;
  locations?: OfficeLocation[];
};

type GpsState = {
  latitude: number;
  longitude: number;
  accuracy: number;
} | null;

type NetworkState = {
  ip: string;
  officeIps: string[];
  matched: boolean;
} | null;

export function AttendanceCard({
  employee,
  today,
  office: officeProp,
  locations: locationsProp = [],
}: Props) {
  const [office, setOffice] = useState<OfficeSettings | null>(officeProp);
  const [locations, setLocations] = useState<OfficeLocation[]>(
    locationsProp.length
      ? locationsProp
      : officeProp?.locations ?? []
  );
  const [gps, setGps] = useState<GpsState>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [matchedBranch, setMatchedBranch] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [network, setNetwork] = useState<NetworkState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [localToday, setLocalToday] = useState(today);
  const [checkoutDialog, setCheckoutDialog] = useState<
    null | "early" | "normal"
  >(null);
  const [iosHint, setIosHint] = useState(false);

  const checkedIn = Boolean(localToday?.check_in_time);
  const checkedOut = Boolean(localToday?.check_out_time);
  const shift = employee.shifts;
  const timezone = office?.timezone ?? "Asia/Karachi";

  const wifiSkipGps = office?.allow_wifi_only_punch !== false;
  const networkOk = Boolean(network?.matched);
  const gpsMatch =
    gps && office
      ? matchOfficeLocation(gps, locations, office.max_gps_accuracy_meters)
      : null;
  const gpsOk = Boolean(gpsMatch);
  const canPunchWifi = Boolean(networkOk && wifiSkipGps);
  const canPunch = Boolean(canPunchWifi || gpsOk);

  const earlyNow = useMemo(() => {
    if (!shift) return false;
    return isEarlyLeave(new Date().toISOString(), shift.end_time, timezone);
  }, [shift, timezone, checkoutDialog]);

  const applyGps = useCallback(
    (next: GpsState, locs: OfficeLocation[], settings: OfficeSettings | null) => {
      setGps(next);
      if (!next || !settings) {
        setMatchedBranch(null);
        setDistance(null);
        return;
      }
      const match = matchOfficeLocation(
        next,
        locs,
        settings.max_gps_accuracy_meters
      );
      if (match) {
        setMatchedBranch(match.location.name);
        setDistance(match.distanceMeters);
      } else {
        setMatchedBranch(null);
        // Show distance to nearest branch for feedback
        let nearest: number | null = null;
        for (const loc of locs.filter((l) => l.is_active)) {
          const d = Math.round(
            6371000 *
              2 *
              Math.atan2(
                Math.sqrt(
                  Math.sin(
                    (((loc.latitude - next.latitude) * Math.PI) / 180) / 2
                  ) **
                    2 +
                    Math.cos((next.latitude * Math.PI) / 180) *
                      Math.cos((loc.latitude * Math.PI) / 180) *
                      Math.sin(
                        (((loc.longitude - next.longitude) * Math.PI) / 180) / 2
                      ) **
                        2
                ),
                Math.sqrt(
                  1 -
                    (Math.sin(
                      (((loc.latitude - next.latitude) * Math.PI) / 180) / 2
                    ) **
                      2 +
                      Math.cos((next.latitude * Math.PI) / 180) *
                        Math.cos((loc.latitude * Math.PI) / 180) *
                        Math.sin(
                          (((loc.longitude - next.longitude) * Math.PI) / 180) /
                            2
                        ) **
                          2)
                )
              )
          );
          if (nearest == null || d < nearest) nearest = d;
        }
        setDistance(nearest);
      }
    },
    []
  );

  const refreshNetwork = useCallback(async () => {
    try {
      const res = await fetch(`/api/network/my-ip?ts=${Date.now()}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) return null;
      const data = await res.json();
      const next = {
        ip: data.ip ?? "",
        officeIps: data.officeIps ?? [],
        matched: Boolean(data.matched),
      };
      setNetwork(next);
      return next;
    } catch {
      return null;
    }
  }, []);

  const refreshOffice = useCallback(async () => {
    try {
      const res = await fetch(`/api/attendance/today?ts=${Date.now()}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.office) setOffice(data.office as OfficeSettings);
      if (data.locations) setLocations(data.locations as OfficeLocation[]);
      else if (data.office?.locations) {
        setLocations(data.office.locations as OfficeLocation[]);
      }
      if (data.attendance) setLocalToday(data.attendance);
    } catch {
      // ignore
    }
  }, []);

  const refreshGps = useCallback(async () => {
    setGpsError(null);
    setGpsLoading(true);
    const acceptAccuracy =
      office?.max_gps_accuracy_meters && office.max_gps_accuracy_meters > 0
        ? office.max_gps_accuracy_meters
        : 100;
    try {
      const reading = await acquireLiveGps({
        acceptAccuracyMeters: acceptAccuracy,
        watchMs: 15000,
        rejectCoarse: false,
        onProgress: (r) => {
          applyGps(
            {
              latitude: r.latitude,
              longitude: r.longitude,
              accuracy: r.accuracy,
            },
            locations,
            office
          );
        },
      });
      applyGps(
        {
          latitude: reading.latitude,
          longitude: reading.longitude,
          accuracy: reading.accuracy,
        },
        locations,
        office
      );
    } catch (e) {
      setGpsError(
        e instanceof LiveGpsError
          ? e.message
          : "Location access is required. Please allow location in your browser settings."
      );
    } finally {
      setGpsLoading(false);
    }
  }, [applyGps, locations, office]);

  useEffect(() => {
    setIosHint(isIosDevice());
    void refreshOffice();
    void refreshNetwork();
    if (!isIosDevice()) {
      void refreshGps();
    }
    const id = window.setInterval(() => {
      void refreshNetwork();
      void refreshOffice();
    }, 15000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  useEffect(() => {
    if (gps) applyGps(gps, locations, office);
  }, [locations, office, gps, applyGps]);

  function requireReadyForPunch(currentNetwork: NetworkState | null): boolean {
    setError(null);
    setMessage(null);

    if (!office) {
      setError("Office settings are not configured.");
      return false;
    }
    if (locations.filter((l) => l.is_active).length === 0) {
      setError("No office locations configured. Ask an admin to add HQ / branches.");
      return false;
    }

    const onWifi = Boolean(currentNetwork?.matched);
    if (onWifi && wifiSkipGps) {
      return true;
    }

    // Off Wi‑Fi (or Wi‑Fi skip disabled): GPS required at a branch
    if (!gps) {
      setError(
        isIosDevice()
          ? "Not on office Wi‑Fi — tap “Enable location”, allow Location, then try again."
          : "Not on office Wi‑Fi — location is required. Allow GPS and stand at an office / branch."
      );
      return false;
    }
    const match = matchOfficeLocation(
      gps,
      locations,
      office.max_gps_accuracy_meters
    );
    if (!match) {
      if (gps.accuracy > office.max_gps_accuracy_meters) {
        setError(
          `GPS accuracy is too low (${Math.round(gps.accuracy)}m / max ${office.max_gps_accuracy_meters}m). Move to an open area.`
        );
      } else {
        setError(
          `You are outside every office location${distance != null ? ` (nearest ~${distance}m)` : ""}. Move inside a branch radius, or connect to office Wi‑Fi.`
        );
      }
      return false;
    }
    return true;
  }

  async function punch(action: "check-in" | "check-out") {
    setBusy(true);
    setError(null);
    try {
      await refreshOffice();
      const latestNetwork = (await refreshNetwork()) ?? network;

      if (!requireReadyForPunch(latestNetwork)) {
        setCheckoutDialog(null);
        return;
      }

      const res = await fetch(`/api/attendance/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        credentials: "same-origin",
        body: JSON.stringify(gps ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "Unable to complete attendance.");
        setCheckoutDialog(null);
        void refreshNetwork();
        return;
      }
      setLocalToday(data.attendance);
      setMessage(data.message);
      if (data.distanceMeters != null) setDistance(data.distanceMeters);
      if (data.locationName) setMatchedBranch(data.locationName);
      setCheckoutDialog(null);
    } finally {
      setBusy(false);
    }
  }

  async function requestCheckOut() {
    setBusy(true);
    setError(null);
    try {
      await refreshOffice();
      const latestNetwork = (await refreshNetwork()) ?? network;
      if (!requireReadyForPunch(latestNetwork)) return;
      setCheckoutDialog(earlyNow ? "early" : "normal");
    } finally {
      setBusy(false);
    }
  }

  const minutesLeft =
    shift != null ? minutesUntilShiftEnd(shift.end_time, timezone) : 0;

  return (
    <Card className="space-y-5">
      <div>
        <p className="text-sm text-slate-500">
          {greetingForNow(timezone)}, {employee.name.split(" ")[0]}
        </p>
        <p className="mt-1 text-xl font-semibold text-slate-900">
          {formatDate(new Date(), timezone)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-slate-500">Shift</p>
          <p className="font-medium text-slate-900">
            {shift
              ? `${shift.start_time.slice(0, 5)} – ${shift.end_time.slice(0, 5)}`
              : "Not assigned"}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Working time</p>
          <p className="font-medium text-slate-900">
            {formatMinutes(localToday?.total_work_minutes)}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Check in</p>
          <p className="font-medium text-slate-900">
            {formatTime(localToday?.check_in_time, timezone)}
            {localToday?.is_late ? (
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800">
                LATE
              </span>
            ) : null}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Check out</p>
          <p className="font-medium text-slate-900">
            {formatTime(localToday?.check_out_time, timezone)}
            {localToday?.is_early_leave ? (
              <span className="ml-2 rounded bg-orange-100 px-1.5 py-0.5 text-xs font-semibold text-orange-800">
                EARLY
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
        <StatusRow
          label="Network"
          ok={networkOk}
          text={
            !network
              ? "Checking…"
              : networkOk
                ? `Office Wi‑Fi · ${network.ip}`
                : `Other network · ${network.ip || "unknown"}`
          }
        />
        <StatusRow
          label="Location"
          ok={Boolean(gpsOk || canPunchWifi)}
          text={
            gpsOk
              ? `${matchedBranch ?? "Office"} · ${distance}m`
              : canPunchWifi
                ? "Not required on office Wi‑Fi"
                : gpsError
                  ? "Permission needed"
                  : distance == null
                    ? gpsLoading
                      ? "Checking…"
                      : iosHint
                        ? "Tap Enable location"
                        : "Checking…"
                    : `Outside branches · ~${distance}m`
          }
        />
        <StatusRow
          label="GPS accuracy"
          ok={Boolean(
            (gpsOk && gps) ||
              canPunchWifi ||
              (gps != null &&
                office != null &&
                gps.accuracy <= office.max_gps_accuracy_meters)
          )}
          text={
            canPunchWifi && !gpsOk
              ? "Skipped on office Wi‑Fi"
              : gps
                ? `${Math.round(gps.accuracy)}m / max ${office?.max_gps_accuracy_meters ?? "—"}m`
                : gpsError
                  ? "Unavailable"
                  : gpsLoading
                    ? "Checking…"
                    : "—"
          }
        />
        {!networkOk && (
          <p className="text-xs text-amber-700">
            Off office Wi‑Fi: GPS must match HQ / a branch
            {locations.length > 0
              ? ` (${locations
                  .filter((l) => l.is_active)
                  .map((l) => l.name)
                  .join(", ")})`
              : ""}
            .
            {isIosSafari()
              ? " Safari tip: allow Location; Private Relay can also change your IP."
              : ""}
          </p>
        )}
        {gpsError && !canPunchWifi && (
          <p className="text-xs text-amber-700">{gpsError}</p>
        )}
      </div>

      {iosHint && !gps && !canPunchWifi && (
        <Button
          type="button"
          className="w-full"
          disabled={gpsLoading || busy}
          onClick={() => void refreshGps()}
        >
          {gpsLoading ? "Getting GPS…" : "Enable location"}
        </Button>
      )}

      {!canPunch && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Punch on <strong>office Wi‑Fi</strong> (no GPS needed), or on any
          network while GPS shows you inside an office / branch.
        </p>
      )}

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

      <div className="flex flex-col gap-2">
        {!checkedIn && (
          <Button
            size="lg"
            className="w-full"
            disabled={busy || !canPunch}
            onClick={() => void punch("check-in")}
          >
            {busy ? "Checking in…" : "CHECK IN"}
          </Button>
        )}
        {checkedIn && !checkedOut && (
          <Button
            size="lg"
            variant="secondary"
            className="w-full border border-slate-300"
            disabled={busy || !canPunch}
            onClick={() => void requestCheckOut()}
          >
            {busy ? "Preparing…" : "CHECK OUT"}
          </Button>
        )}
        {checkedIn && checkedOut && (
          <p className="text-center text-sm font-medium text-slate-600">
            Attendance complete for today
          </p>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void refreshOffice();
            void refreshNetwork();
            if (!canPunchWifi) void refreshGps();
          }}
          disabled={busy || gpsLoading}
        >
          Refresh
        </Button>
      </div>

      <ConfirmDialog
        open={checkoutDialog === "early"}
        tone="warning"
        pending={busy}
        title="Leaving before shift end?"
        description={
          shift
            ? `Your shift ends at ${formatShiftClock(shift.end_time)}. About ${Math.max(minutesLeft, 0)} minute(s) remain. Early check-out will be recorded.`
            : "You are checking out early. Continue only if you mean to leave."
        }
        confirmLabel="Yes, check out early"
        cancelLabel="Stay clocked in"
        onCancel={() => setCheckoutDialog(null)}
        onConfirm={() => void punch("check-out")}
      />

      <ConfirmDialog
        open={checkoutDialog === "normal"}
        pending={busy}
        title="Confirm check-out"
        description="Are you sure you want to check out for today? This cannot be undone by you."
        confirmLabel="Yes, check out"
        cancelLabel="Cancel"
        onCancel={() => setCheckoutDialog(null)}
        onConfirm={() => void punch("check-out")}
      />
    </Card>
  );
}

function StatusRow({
  label,
  ok,
  text,
}: {
  label: string;
  ok: boolean;
  text: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span
        className={
          ok ? "font-medium text-teal-700" : "font-medium text-amber-700"
        }
      >
        {ok ? "✓ " : ""}
        {text}
      </span>
    </div>
  );
}
