/**
 * Map Postgres / Auth / Zod-ish errors to plain language for admins.
 * Never expose raw constraint names in the UI.
 */
export function friendlyEmployeeError(
  raw: string | null | undefined,
  fallback = "Could not save employee. Please check the form and try again."
): string {
  const message = (raw ?? "").trim();
  if (!message) return fallback;
  const lower = message.toLowerCase();

  if (
    lower.includes("employees_mobile_key") ||
    (lower.includes("duplicate") && lower.includes("mobile"))
  ) {
    return "An employee with this phone number already exists. Use a different number.";
  }

  if (
    lower.includes("employees_employee_id_key") ||
    (lower.includes("duplicate") && lower.includes("employee_id"))
  ) {
    return "This employee ID is already in use. Try again or pick another ID.";
  }

  if (
    lower.includes("employees_auth_user_id_key") ||
    (lower.includes("duplicate") && lower.includes("auth_user"))
  ) {
    return "This login account is already linked to another employee.";
  }

  if (
    lower.includes("employees_role_check") ||
    (lower.includes("role") && lower.includes("check constraint"))
  ) {
    return "That role is not allowed yet. Ask IT to run the Admin Viewer database update, then try again.";
  }

  if (
    lower.includes("already registered") ||
    lower.includes("user already exists") ||
    lower.includes("email_exists") ||
    (lower.includes("duplicate") && lower.includes("email"))
  ) {
    return "This login email is already registered. Use a different email.";
  }

  if (lower.includes("invalid email") || lower.includes("email address")) {
    return "Enter a valid login email address.";
  }

  if (lower.includes("password") && lower.includes("least")) {
    return "Temporary password must be at least 8 characters.";
  }

  // Zod-style without field names
  if (lower.includes("too small") && lower.includes(">=10")) {
    return "Phone number must be at least 10 digits.";
  }
  if (lower.includes("too small") && lower.includes(">=2")) {
    return "Name and designation must be at least 2 characters.";
  }
  if (lower.includes("too small") && lower.includes(">=8")) {
    return "Password must be at least 8 characters.";
  }
  if (lower.includes("invalid email") || lower === "invalid string") {
    return "Enter a valid login email address.";
  }

  // Hide raw Postgres noise
  if (
    lower.includes("violates") ||
    lower.includes("duplicate key") ||
    lower.includes("relation") ||
    lower.includes("constraint")
  ) {
    return fallback;
  }

  // Short, already human messages
  if (message.length <= 160 && !lower.includes("postgres")) {
    return message;
  }

  return fallback;
}
