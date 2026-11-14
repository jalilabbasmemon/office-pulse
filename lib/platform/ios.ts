/** Client-side iOS / Safari helpers for install + GPS guidance. */

export function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ can report as Mac
  const iPadOs =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

/** True Safari on iOS (not Chrome/Firefox/Edge wrappers, not in-app browsers). */
export function isIosSafari() {
  if (!isIosDevice()) return false;
  const ua = navigator.userAgent;
  // CriOS = Chrome iOS, FxiOS = Firefox, EdgiOS = Edge, OPR = Opera
  if (/CriOS|FxiOS|EdgiOS|OPR\//i.test(ua)) return false;
  // Instagram, Facebook, LinkedIn, etc. in-app browsers
  if (/FBAN|FBAV|Instagram|Line\//i.test(ua)) return false;
  // Safari includes Version/… and Mobile/… and does not include those wrappers
  return /Safari/i.test(ua);
}

export function isIosInAppBrowser() {
  if (!isIosDevice()) return false;
  return !isIosSafari();
}

export function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}
