"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "warning";
  pending?: boolean;
  /** When set, user must type this exact text before Confirm is enabled. */
  confirmText?: string;
  confirmTextLabel?: string;
  /** Force typed confirmation to uppercase (e.g. DELETE). Default true when confirmText is uppercase. */
  confirmTextUppercase?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  pending,
  confirmText,
  confirmTextLabel,
  confirmTextUppercase,
  onConfirm,
  onCancel,
}: Props) {
  const [typed, setTyped] = useState("");
  const forceUpper =
    confirmTextUppercase ??
    Boolean(confirmText && confirmText === confirmText.toUpperCase());

  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  if (!open) return null;

  const needsTypedConfirm = Boolean(confirmText);
  const typedOk = !needsTypedConfirm || typed === confirmText;
  const canConfirm = typedOk && !pending;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <h2
          id="confirm-title"
          className="text-lg font-semibold text-slate-900"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {description}
        </p>
        {needsTypedConfirm && (
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="confirm-typed">
              {confirmTextLabel ?? (
                <>
                  Type{" "}
                  <span className="font-mono font-semibold">{confirmText}</span>{" "}
                  to confirm
                </>
              )}
            </Label>
            <Input
              id="confirm-typed"
              autoFocus
              className="font-mono uppercase tracking-wide"
              value={typed}
              onChange={(e) => {
                const next = forceUpper
                  ? e.target.value.toUpperCase()
                  : e.target.value;
                setTyped(next);
              }}
              placeholder={confirmText}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              disabled={pending}
            />
          </div>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === "warning" ? "danger" : "default"}
            disabled={!canConfirm}
            onClick={onConfirm}
          >
            {pending ? "Please wait…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
