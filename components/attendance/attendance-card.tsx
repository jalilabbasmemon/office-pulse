"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate, formatMinutes, formatTime } from "@/lib/utils";
import { greetingForNow } from "@/lib/attendance/timezone";
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

  const checkedIn = Boolean(localToday?.check_in_time);
  const checkedOut = Boolean(localToday?.check_out_time);

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
          // Approximate client-side preview only — server re-validates
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

  function punch(action: "check-in" | "check-out") {
    setError(null);
    setMessage(null);

    if (!gps) {
      setError("Waiting for GPS. Please allow location access.");
      refreshGps();
      return;
    }

    startTransition(async () => {
      const res = await fetch(`/api/attendance/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gps),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Unable to complete attendance.");
        return;
      }
      setLocalToday(data.attendance);
      setMessage(data.message);
      setDistance(data.distanceMeters ?? distance);
    });
  }

  const shift = employee.shifts;
  const locationOk =
    office && distance != null && distance <= office.allowed_radius_meters;
  const accuracyOk =
    office && gps && gps.accuracy <= office.max_gps_accuracy_meters;

  return (
    <Card className="space-y-5">
      <div>
        <p className="text-sm text-slate-500">
          {greetingForNow(office?.timezone)}, {employee.name.split(" ")[0]}
        </p>
        <p className="mt-1 text-xl font-semibold text-slate-900">
          {formatDate(new Date(), office?.timezone)}
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
            {formatTime(localToday?.check_in_time, office?.timezone)}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Check out</p>
          <p className="font-medium text-slate-900">
            {formatTime(localToday?.check_out_time, office?.timezone)}
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
                  office
                    ? ` / max ${office.max_gps_accuracy_meters}m`
                    : ""
                }`
              : gpsError
                ? "Unavailable"
                : "Checking…"
          }
        />
        <StatusRow
          label="Network"
          ok={true}
          text="Office public IP checked on punch"
        />
      </div>

      {gps && office && gps.accuracy > office.max_gps_accuracy_meters && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          GPS accuracy is too coarse ({Math.round(gps.accuracy)}m). Desktops
          often fail this check — open this page on a phone at the office, or
          ask admin to raise Max GPS accuracy in Settings for testing.
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
            disabled={pending}
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
            disabled={pending}
            onClick={() => punch("check-out")}
          >
            {pending ? "Checking out…" : "CHECK OUT"}
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
      <span className={ok ? "font-medium text-teal-700" : "font-medium text-amber-700"}>
        {ok ? "✓ " : ""}
        {text}
      </span>
    </div>
  );
}
