"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  isIosDevice,
  isIosSafari,
  isStandaloneDisplay,
} from "@/lib/platform/ios";

const DISMISS_KEY = "officepulse-install-dismissed";

/**
 * Always-available iPhone install instructions (Apple has no Install button).
 * Shown on Profile when not already running as a home-screen app.
 */
export function IosInstallHelp() {
  const [show, setShow] = useState(false);
  const [inSafari, setInSafari] = useState(true);

  useEffect(() => {
    if (!isIosDevice() || isStandaloneDisplay()) {
      setShow(false);
      return;
    }
    setInSafari(isIosSafari());
    setShow(true);
  }, []);

  if (!show) return null;

  function showBannerAgain() {
    try {
      localStorage.removeItem(DISMISS_KEY);
    } catch {
      // ignore
    }
    // Soft reload so InstallPrompt re-reads dismiss flag
    window.location.reload();
  }

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 space-y-3">
      <h2 className="font-semibold text-slate-900">Install on iPhone / iPad</h2>
      <p className="text-sm text-slate-700">
        Apple does <strong>not</strong> allow a normal “Install app” button for
        websites. You add OfficePulse from <strong>Safari</strong> only:
      </p>

      {!inSafari ? (
        <ol className="list-decimal space-y-1 pl-4 text-sm text-slate-700">
          <li>
            Tap <strong>⋯</strong> or Share → <strong>Open in Safari</strong>
          </li>
          <li>
            In Safari: Share (square with ↑) → <strong>Add to Home Screen</strong>
          </li>
          <li>
            Tap <strong>Add</strong>, then open the new home-screen icon
          </li>
        </ol>
      ) : (
        <ol className="list-decimal space-y-1 pl-4 text-sm text-slate-700">
          <li>
            Tap the <strong>Share</strong> button (square with ↑) at the bottom
          </li>
          <li>
            Scroll and tap <strong>Add to Home Screen</strong>
          </li>
          <li>
            Tap <strong>Add</strong>
          </li>
          <li>
            Open the OfficePulse icon and allow <strong>Location</strong>
          </li>
        </ol>
      )}

      <Button type="button" variant="outline" size="sm" onClick={showBannerAgain}>
        Show install tip again
      </Button>
    </div>
  );
}
