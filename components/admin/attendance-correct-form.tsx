"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AttendanceCorrectForm({
  attendanceId,
  checkIn,
  checkOut,
}: {
  attendanceId: string;
  checkIn: string | null;
  checkOut: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [checkInLocal, setCheckInLocal] = useState(
    checkIn ? toLocalInput(checkIn) : ""
  );
  const [checkOutLocal, setCheckOutLocal] = useState(
    checkOut ? toLocalInput(checkOut) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/attendance/${attendanceId}/correct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          check_in_time: checkInLocal
            ? new Date(checkInLocal).toISOString()
            : null,
          check_out_time: checkOutLocal
            ? new Date(checkOutLocal).toISOString()
            : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Correction failed");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Correct
      </Button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
    >
      <div>
        <Label>Check in</Label>
        <Input
          type="datetime-local"
          value={checkInLocal}
          onChange={(e) => setCheckInLocal(e.target.value)}
        />
      </div>
      <div>
        <Label>Check out</Label>
        <Input
          type="datetime-local"
          value={checkOutLocal}
          onChange={(e) => setCheckOutLocal(e.target.value)}
        />
      </div>
      <div>
        <Label>Reason</Label>
        <Input
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Forgot checkout"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
