import { createClient } from "@/lib/supabase/server";

type AuditInput = {
  adminId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  reason?: string | null;
  ipAddress?: string | null;
};

export async function writeAuditLog(input: AuditInput) {
  const supabase = await createClient();
  const row: Record<string, unknown> = {
    admin_id: input.adminId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    old_data: input.oldData ?? null,
    new_data: input.newData ?? null,
    ip_address: input.ipAddress ?? null,
  };
  if (input.reason != null) {
    row.reason = input.reason;
  }

  const { error } = await supabase.from("audit_logs").insert(row);
  if (error) {
    // Retry without reason if the column was never migrated
    if (input.reason != null && /reason/i.test(error.message)) {
      delete row.reason;
      const retry = await supabase.from("audit_logs").insert(row);
      if (retry.error) throw new Error(retry.error.message);
      return;
    }
    throw new Error(error.message);
  }
}
