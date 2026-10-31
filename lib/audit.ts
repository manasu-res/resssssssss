export interface AuditLogEntry {
  action: 'APPROVE_ORDER' | 'REJECT_ORDER' | 'CANCEL_ORDER' | 'SETTLE_BILL' | 'CANCEL_BILL' | 'UPDATE_ORDER_STATUS';
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  targetId: string;
  details?: Record<string, any> | string;
}

export function logAudit(entry: AuditLogEntry) {
  const timestamp = new Date().toISOString();
  const actor = entry.actorName 
    ? `${entry.actorName} (ID: ${entry.actorId || 'system'}, Role: ${entry.actorRole || 'staff'})`
    : `ID: ${entry.actorId || 'system'} (Role: ${entry.actorRole || 'staff'})`;
  const detailStr = entry.details 
    ? ` | Details: ${typeof entry.details === 'object' ? JSON.stringify(entry.details) : entry.details}` 
    : '';
  console.log(`[AUDIT] [${timestamp}] [${entry.action}] Actor: ${actor} | Target: ${entry.targetId}${detailStr}`);
}
