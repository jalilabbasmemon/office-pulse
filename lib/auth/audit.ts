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
  await supabase.from("audit_logs").insert({
    admin_id: input.adminId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    old_data: input.oldData ?? null,
    new_data: input.newData ?? null,
    reason: input.reason ?? null,
    ip_address: input.ipAddress ?? null,
  });
}
