"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "officepulse-install-dismissed";

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    if (isIos()) {
      setIosHint(true);
      setVisible(true);
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (!visible) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-sm">
      <div className="rounded-2xl border border-teal-200 bg-white p-4 shadow-lg">
        <p className="text-sm font-semibold text-slate-900">
          Install OfficePulse
        </p>
        {iosHint ? (
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            On iPhone/iPad: tap the <strong>Share</strong> button, then{" "}
            <strong>Add to Home Screen</strong> to install this app.
          </p>
        ) : (
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Add a home screen or desktop shortcut for faster check-in and
            check-out.
          </p>
        )}
        <div className="mt-3 flex gap-2">
          {!iosHint && deferred && (
            <Button type="button" className="flex-1" onClick={install}>
              Install app
            </Button>
          )}
          <Button
            type="button"
            variant={iosHint || !deferred ? "default" : "outline"}
            className="flex-1"
            onClick={dismiss}
          >
            {iosHint ? "Got it" : "Not now"}
          </Button>
        </div>
      </div>
    </div>
  );
}
