export interface PendingModerationTransition {
  isExistingListing: boolean;
  previousStatus?: string | null;
  nextStatus?: string | null;
  isStaffEdit: boolean;
}

export function shouldNotifyPendingModeration({
  isExistingListing,
  previousStatus,
  nextStatus,
  isStaffEdit,
}: PendingModerationTransition): boolean {
  if (nextStatus !== 'pending') return false;
  if (!isExistingListing) return true;
  if (isStaffEdit) return false;
  return previousStatus !== 'pending';
}
