/** Next EMP### / ADM### style ID from existing IDs. */
export function nextEmployeeId(
  existingIds: string[],
  role: "ADMIN" | "EMPLOYEE" = "EMPLOYEE"
): string {
  const prefix = role === "ADMIN" ? "ADM" : "EMP";
  let max = 0;
  for (const id of existingIds) {
    const match = id.match(new RegExp(`^${prefix}(\\d+)$`, "i"));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export function generateTempPassword(length = 10): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  // Works in browser and Node
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
