"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import type { Shift } from "@/types";

export function ShiftsManager({ shifts }: { shifts: Shift[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    start_time: "09:00",
    end_time: "18:00",
    grace_minutes: 15,
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, status: "ACTIVE" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Could not create shift");
        return;
      }
      setForm({ name: "", start_time: "09:00", end_time: "18:00", grace_minutes: 15 });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <h2 className="font-semibold text-slate-900">Existing shifts</h2>
        <ul className="divide-y divide-slate-100">
          {shifts.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-slate-500">
                  {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)} · grace{" "}
                  {s.grace_minutes}m
                </p>
              </div>
              <span className="text-xs text-slate-400">{s.status}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold text-slate-900">Add shift</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="start">Start</Label>
              <Input
                id="start"
                type="time"
                required
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="end">End</Label>
              <Input
                id="end"
                type="time"
                required
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="grace">Grace minutes</Label>
            <Input
              id="grace"
              type="number"
              value={form.grace_minutes}
              onChange={(e) =>
                setForm({ ...form, grace_minutes: Number(e.target.value) })
              }
            />
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Create shift"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
