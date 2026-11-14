/** Redacted credential accessors — never log values. */

export function hasEmployeeCreds() {
  return Boolean(
    process.env.E2E_EMPLOYEE_EMAIL && process.env.E2E_EMPLOYEE_PASSWORD
  );
}

export function hasAdminCreds() {
  return Boolean(process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD);
}

export function hasViewerCreds() {
  return Boolean(
    process.env.E2E_VIEWER_EMAIL && process.env.E2E_VIEWER_PASSWORD
  );
}

export function hasForcedPasswordCreds() {
  return Boolean(
    process.env.E2E_FORCE_PW_EMAIL && process.env.E2E_FORCE_PW_PASSWORD
  );
}

export function employeeEmail() {
  return process.env.E2E_EMPLOYEE_EMAIL!;
}

export function employeePassword() {
  return process.env.E2E_EMPLOYEE_PASSWORD!;
}

export function adminEmail() {
  return process.env.E2E_ADMIN_EMAIL!;
}

export function adminPassword() {
  return process.env.E2E_ADMIN_PASSWORD!;
}

export function viewerEmail() {
  return process.env.E2E_VIEWER_EMAIL!;
}

export function viewerPassword() {
  return process.env.E2E_VIEWER_PASSWORD!;
}

/** Office allow-list IP used by the non-prod trusted IP adapter. */
export function e2eOfficeIp() {
  return process.env.E2E_OFFICE_IP || "203.0.113.10";
}

/** Branch coordinates for GPS geofence tests (must match a test office_locations row). */
export function e2eOfficeCoords() {
  return {
    latitude: Number(process.env.E2E_OFFICE_LAT ?? "24.8607"),
    longitude: Number(process.env.E2E_OFFICE_LNG ?? "67.0011"),
    accuracy: Number(process.env.E2E_OFFICE_ACCURACY ?? "15"),
  };
}

export function skipReasonMissing(kind: string) {
  return `Skipped: set E2E_* credentials for ${kind} against a nonproduction database. Do not use live employee accounts.`;
}
