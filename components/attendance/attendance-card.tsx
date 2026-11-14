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
import {
  acquireLiveGps,
  LiveGpsError,
} from "@/lib/location/live-gps";
import { isIosDevice, isIosSafari } from "@/lib/platform/ios";
import type { Attendance, Employee, OfficeSettings } from "@/types";

type Props = {
  employee: Employee;
  today: Attendance | null;
  office: OfficeSettings | null;
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

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function AttendanceCard({ employee, today, office: officeProp }: Props) {
  const [office, setOffice] = useState<OfficeSettings | null>(officeProp);
  const [gps, setGps] = useState<GpsState>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
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

  const wifiOnlyAllowed = office?.allow_wifi_only_punch !== false;
  const locationOk =
    office != null &&
    distance != null &&
    distance <= office.allowed_radius_meters;
  const accuracyOk =
    office != null &&
    gps != null &&
    gps.accuracy <= office.max_gps_accuracy_meters;
  const gpsOk = Boolean(gps && locationOk && accuracyOk);
  const networkOk = Boolean(network?.matched);
  const canPunch = Boolean(networkOk && (gpsOk || wifiOnlyAllowed));

  const earlyNow = useMemo(() => {
    if (!shift) return false;
    return isEarlyLeave(new Date().toISOString(), shift.end_time, timezone);
  }, [shift, timezone, checkoutDialog]);

  const refreshNetwork = useCallback(async () => {
    try {
      const res = await fetch(`/api/network/my-ip?ts=${Date.now()}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) return;
      const data = await res.json();
      setNetwork({
        ip: data.ip ?? "",
        officeIps: data.officeIps ?? [],
        matched: Boolean(data.matched),
      });
    } catch {
      // ignore transient errors; server still validates on punch
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
      if (data.attendance) setLocalToday(data.attendance);
    } catch {
      // ignore
    }
  }, []);

  const refreshGps = useCallback(async () => {
    setGpsError(null);
    setGpsLoading(true);
    try {
      const reading = await acquireLiveGps({
        acceptAccuracyMeters: 100,
        watchMs: 15000,
        rejectCoarse: false,
        onProgress: (r) => {
          setGps({
            latitude: r.latitude,
            longitude: r.longitude,
            accuracy: r.accuracy,
          });
        },
      });
      const next = {
        latitude: reading.latitude,
        longitude: reading.longitude,
        accuracy: reading.accuracy,
      };
      setGps(next);
      setOffice((current) => {
        if (current) {
          setDistance(
            haversineMeters(
              next.latitude,
              next.longitude,
              current.latitude,
              current.longitude
            )
          );
        }
        return current;
      });
    } catch (e) {
      setGpsError(
        e instanceof LiveGpsError
          ? e.message
          : "Location access is required. Please allow location in your browser settings."
      );
    } finally {
      setGpsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIosHint(isIosDevice());
    void refreshOffice();
    void refreshNetwork();
    // iOS Safari often blocks geolocation until a user tap — wait for that.
    if (!isIosDevice()) {
      void refreshGps();
    }
    const id = window.setInterval(() => {
      void refreshNetwork();
      void refreshOffice();
    }, 15000);
    return () => window.clearInterval(id);
  }, [refreshOffice, refreshNetwork, refreshGps]);

  useEffect(() => {
    if (office && gps) {
      setDistance(
        haversineMeters(
          gps.latitude,
          gps.longitude,
          office.latitude,
          office.longitude
        )
      );
    }
  }, [office, gps]);

  function requireReadyForPunch(currentNetwork: NetworkState | null): boolean {
    setError(null);
    setMessage(null);

    if (!office) {
      setError("Office settings are not configured.");
      return false;
    }
    if (!currentNetwork?.matched) {
      const safariNote = isIosSafari()
        ? " On iPhone Safari: Settings → Apple Account → iCloud → Private Relay → Off (or allow this site), and turn off Limit IP Address Tracking for this website."
        : "";
      setError(
        `Office Wi‑Fi not detected. Your IP: ${currentNetwork?.ip || "unknown"}. Office allows: ${(currentNetwork?.officeIps ?? []).join(", ") || "not set"}.${safariNote}`
      );
      void refreshNetwork();
      return false;
    }
    if (wifiOnlyAllowed) {
      return true;
    }
    if (!gps) {
      setError(
        isIosDevice()
          ? "Tap “Enable location” first, allow Location for Safari, then try again."
          : "Waiting for GPS. Please allow location access."
      );
      return false;
    }
    if (!accuracyOk) {
      setError(
        `GPS accuracy is too low (${Math.round(gps.accuracy)}m / max ${office.max_gps_accuracy_meters}m). Move to an open area.`
      );
      return false;
    }
    if (!locationOk) {
      setError(
        `You appear outside the office (${distance}m away). Stand inside the office radius.`
      );
      return false;
    }
    return true;
  }

  async function punch(action: "check-in" | "check-out") {
    setBusy(true);
    setError(null);
    try {
      await Promise.all([refreshOffice(), refreshNetwork()]);
      // Re-read network from a fresh call so we don't use stale closure
      let latestNetwork = network;
      try {
        const res = await fetch(`/api/network/my-ip?ts=${Date.now()}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (res.ok) {
          const data = await res.json();
          latestNetwork = {
            ip: data.ip ?? "",
            officeIps: data.officeIps ?? [],
            matched: Boolean(data.matched),
          };
          setNetwork(latestNetwork);
        }
      } catch {
        // keep previous
      }

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
      setDistance(data.distanceMeters ?? distance);
      setCheckoutDialog(null);
    } finally {
      setBusy(false);
    }
  }

  async function requestCheckOut() {
    setBusy(true);
    setError(null);
    try {
      await Promise.all([refreshOffice(), refreshNetwork()]);
      let latestNetwork = network;
      try {
        const res = await fetch(`/api/network/my-ip?ts=${Date.now()}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (res.ok) {
          const data = await res.json();
          latestNetwork = {
            ip: data.ip ?? "",
            officeIps: data.officeIps ?? [],
            matched: Boolean(data.matched),
          };
          setNetwork(latestNetwork);
        }
      } catch {
        // keep
      }
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
          label="Location"
          ok={Boolean(gpsOk || (wifiOnlyAllowed && networkOk))}
          text={
            gpsOk
              ? `Office · ${distance}m`
              : wifiOnlyAllowed && networkOk
                ? "Using office Wi‑Fi (GPS optional)"
                : gpsError
                  ? "Permission needed"
                  : distance == null
                    ? wifiOnlyAllowed
                      ? "Optional if Wi‑Fi OK"
                      : gpsLoading
                        ? "Checking…"
                        : iosHint
                          ? "Tap Enable location"
                          : "Checking…"
                    : `${distance}m away`
          }
        />
        <StatusRow
          label="GPS accuracy"
          ok={Boolean(accuracyOk || (wifiOnlyAllowed && networkOk))}
          text={
            accuracyOk
              ? `${Math.round(gps!.accuracy)}m / max ${office?.max_gps_accuracy_meters ?? "—"}m`
              : wifiOnlyAllowed && networkOk
                ? "Not required on office Wi‑Fi"
                : gps
                  ? `${Math.round(gps.accuracy)}m / max ${office?.max_gps_accuracy_meters ?? "—"}m`
                  : gpsError
                    ? "Unavailable"
                    : gpsLoading
                      ? "Checking…"
                      : "—"
          }
        />
        <StatusRow
          label="Network"
          ok={networkOk}
          text={
            !network
              ? "Checking…"
              : networkOk
                ? `Office · ${network.ip}`
                : `Blocked · ${network.ip || "unknown"}`
          }
        />
        {network && !networkOk && (
          <p className="text-xs text-amber-700">
            Office allows:{" "}
            {network.officeIps.length > 0
              ? network.officeIps.join(", ")
              : "not configured"}
            {iosHint
              ? ". Safari tip: turn off iCloud Private Relay / Limit IP Address Tracking for this site, stay on office Wi‑Fi, then Refresh."
              : ""}
          </p>
        )}
        {gpsError && (
          <p className="text-xs text-amber-700">{gpsError}</p>
        )}
      </div>

      {iosHint && !gps && !wifiOnlyAllowed && (
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
          {wifiOnlyAllowed
            ? "Punch requires office Wi‑Fi (matching public IP). On iPhone Safari, also disable Private Relay, then tap Refresh."
            : "Punch requires matching office public IP and GPS inside the radius. Tap Refresh after fixing Wi‑Fi / location."}
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
            void refreshGps();
          }}
          disabled={busy || gpsLoading}
        >
          Refresh location & network
        </Button>
      </div>

      <ConfirmDialog
        open={checkoutDialog === "early"}
        tone="warning"
        pending={busy}
        title="Leaving before shift end?"
        description={
          shift
            ? `Your shift ends at ${formatShiftClock(shift.end_time)}. About ${Math.max(minutesLeft, 0)} minute(s) remain. Early check-out will be recorded. Office Wi‑Fi will be verified again.`
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
        description="Are you sure you want to check out for today? This cannot be undone by you. Office Wi‑Fi will be verified on the server."
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
