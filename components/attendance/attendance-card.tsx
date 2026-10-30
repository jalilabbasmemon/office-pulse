"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
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

export function AttendanceCard({ employee, today, office }: Props) {
  const [gps, setGps] = useState<GpsState>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [localToday, setLocalToday] = useState(today);
  const [checkoutDialog, setCheckoutDialog] = useState<
    null | "early" | "normal"
  >(null);

  const checkedIn = Boolean(localToday?.check_in_time);
  const checkedOut = Boolean(localToday?.check_out_time);
  const shift = employee.shifts;
  const timezone = office?.timezone ?? "Asia/Karachi";

  const locationOk =
    office != null &&
    distance != null &&
    distance <= office.allowed_radius_meters;
  const accuracyOk =
    office != null &&
    gps != null &&
    gps.accuracy <= office.max_gps_accuracy_meters;
  const canPunch = Boolean(gps && locationOk && accuracyOk);

  const earlyNow = useMemo(() => {
    if (!shift) return false;
    return isEarlyLeave(new Date().toISOString(), shift.end_time, timezone);
  }, [shift, timezone, checkoutDialog]);

  const refreshGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported on this device.");
      return;
    }
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setGps(next);
        if (office) {
          const R = 6371000;
          const toRad = (d: number) => (d * Math.PI) / 180;
          const dLat = toRad(office.latitude - next.latitude);
          const dLon = toRad(office.longitude - next.longitude);
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(next.latitude)) *
              Math.cos(toRad(office.latitude)) *
              Math.sin(dLon / 2) ** 2;
          const meters = Math.round(
            R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
          );
          setDistance(meters);
        }
      },
      () => {
        setGpsError(
          "Location access is required. Please allow location in your browser settings."
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [office]);

  useEffect(() => {
    refreshGps();
  }, [refreshGps]);

  function requireReadyForPunch(): boolean {
    setError(null);
    setMessage(null);

    if (!gps) {
      setError("Waiting for GPS. Please allow location access.");
      refreshGps();
      return false;
    }
    if (!office) {
      setError("Office settings are not configured.");
      return false;
    }
    if (!accuracyOk) {
      setError(
        `GPS accuracy is too low (${Math.round(gps.accuracy)}m). Move to an open area or use a phone.`
      );
      return false;
    }
    if (!locationOk) {
      setError(
        `You appear outside the office (${distance}m away). Connect to office Wi‑Fi and stand inside the office.`
      );
      return false;
    }
    return true;
  }

  function punch(action: "check-in" | "check-out") {
    if (!requireReadyForPunch() || !gps) return;

    startTransition(async () => {
      const res = await fetch(`/api/attendance/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gps),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Unable to complete attendance.");
        setCheckoutDialog(null);
        return;
      }
      setLocalToday(data.attendance);
      setMessage(data.message);
      setDistance(data.distanceMeters ?? distance);
      setCheckoutDialog(null);
    });
  }

  function requestCheckOut() {
    if (!requireReadyForPunch()) return;
    setCheckoutDialog(earlyNow ? "early" : "normal");
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
          ok={Boolean(locationOk)}
          text={
            gpsError
              ? "Permission needed"
              : distance == null
                ? "Checking…"
                : locationOk
                  ? `Office · ${distance}m`
                  : `${distance}m away`
          }
        />
        <StatusRow
          label="GPS accuracy"
          ok={Boolean(accuracyOk)}
          text={
            gps
              ? `${Math.round(gps.accuracy)}m${
                  office ? ` / max ${office.max_gps_accuracy_meters}m` : ""
                }`
              : gpsError
                ? "Unavailable"
                : "Checking…"
          }
        />
        <StatusRow
          label="Network"
          ok={true}
          text="Office Wi‑Fi IP verified on server at punch"
        />
      </div>

      {!canPunch && !gpsError && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Check-in and check-out both require office Wi‑Fi (public IP) and GPS
          inside the office radius. Fix location/accuracy before punching.
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
            disabled={pending || !canPunch}
            onClick={() => punch("check-in")}
          >
            {pending ? "Checking in…" : "CHECK IN"}
          </Button>
        )}
        {checkedIn && !checkedOut && (
          <Button
            size="lg"
            variant="secondary"
            className="w-full border border-slate-300"
            disabled={pending || !canPunch}
            onClick={requestCheckOut}
          >
            CHECK OUT
          </Button>
        )}
        {checkedIn && checkedOut && (
          <p className="text-center text-sm font-medium text-slate-600">
            Attendance complete for today
          </p>
        )}
        <Button variant="ghost" size="sm" onClick={refreshGps} disabled={pending}>
          Refresh location
        </Button>
      </div>

      <ConfirmDialog
        open={checkoutDialog === "early"}
        tone="warning"
        pending={pending}
        title="Leaving before shift end?"
        description={
          shift
            ? `Your shift ends at ${formatShiftClock(shift.end_time)}. About ${Math.max(minutesLeft, 0)} minute(s) remain. Early check-out will be recorded. Office Wi‑Fi and GPS will be verified again.`
            : "You are checking out early. Continue only if you mean to leave."
        }
        confirmLabel="Yes, check out early"
        cancelLabel="Stay clocked in"
        onCancel={() => setCheckoutDialog(null)}
        onConfirm={() => punch("check-out")}
      />

      <ConfirmDialog
        open={checkoutDialog === "normal"}
        pending={pending}
        title="Confirm check-out"
        description="Are you sure you want to check out for today? This cannot be undone by you. Office Wi‑Fi and GPS will be verified on the server."
        confirmLabel="Yes, check out"
        cancelLabel="Cancel"
        onCancel={() => setCheckoutDialog(null)}
        onConfirm={() => punch("check-out")}
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
