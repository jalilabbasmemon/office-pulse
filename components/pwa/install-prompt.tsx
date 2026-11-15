"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  isIosDevice,
  isIosInAppBrowser,
  isIosSafari,
  isStandaloneDisplay,
} from "@/lib/platform/ios";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "officepulse-install-dismissed";

/** Auth / password screens must stay fully tappable (Safari + small phones). */
function isAuthCriticalPath(pathname: string | null) {
  if (!pathname) return false;
  return (
    pathname === "/login" ||
    pathname.startsWith("/change-password") ||
    pathname.startsWith("/api/auth")
  );
}

export function InstallPrompt() {
  const pathname = usePathname();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<"ios-safari" | "ios-other" | "android">(
    "android"
  );

  useEffect(() => {
    if (isStandaloneDisplay()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    // Never cover Sign in / password change — confirmed WebKit/iPhone failure mode.
    if (isAuthCriticalPath(pathname)) {
      setVisible(false);
      return;
    }

    if (isIosDevice()) {
      setMode(isIosInAppBrowser() || !isIosSafari() ? "ios-other" : "ios-safari");
      setVisible(true);
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    const timer = window.setTimeout(() => setVisible(true), 2500);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, [pathname]);

  if (!visible || isAuthCriticalPath(pathname)) return null;

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
        <div className="mb-2 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo.png"
            alt=""
            className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200"
          />
          <p className="text-sm font-semibold text-slate-900">
            {mode === "ios-other" ? "Open in Safari" : "Install OfficePulse"}
          </p>
        </div>

        {mode === "ios-other" ? (
          <div className="mt-1 space-y-2 text-xs leading-relaxed text-slate-600">
            <p>
              <strong>Apple does not allow Install from Chrome / WhatsApp.</strong>{" "}
              Open this site in <strong>Safari</strong> first.
            </p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>
                Tap the <strong>⋯</strong> or Share menu
              </li>
              <li>
                Choose <strong>Open in Safari</strong>
              </li>
              <li>
                In Safari: Share → <strong>Add to Home Screen</strong> →{" "}
                <strong>Add</strong>
              </li>
            </ol>
          </div>
        ) : mode === "ios-safari" ? (
          <div className="mt-1 space-y-2 text-xs leading-relaxed text-slate-600">
            <p>
              <strong>There is no Install button on iPhone.</strong> Use Safari
              Share instead:
            </p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>
                Tap <strong>Share</strong> (square with ↑) at the bottom of Safari
              </li>
              <li>
                Scroll → <strong>Add to Home Screen</strong>
              </li>
              <li>
                Tap <strong>Add</strong>
              </li>
            </ol>
            <p>
              Then open the home-screen icon and allow <strong>Location</strong>.
            </p>
          </div>
        ) : deferred ? (
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Add a home screen shortcut for faster check-in and check-out.
          </p>
        ) : (
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            On Android Chrome: menu (⋮) → <strong>Install app</strong> or{" "}
            <strong>Add to Home screen</strong>.
          </p>
        )}

        <div className="mt-3 flex gap-2">
          {mode === "android" && deferred && (
            <Button type="button" className="flex-1" onClick={install}>
              Install app
            </Button>
          )}
          <Button
            type="button"
            variant={
              mode.startsWith("ios") || !deferred ? "default" : "outline"
            }
            className="flex-1"
            onClick={dismiss}
          >
            {mode.startsWith("ios") ? "Got it" : "Not now"}
          </Button>
        </div>
      </div>
    </div>
  );
}
