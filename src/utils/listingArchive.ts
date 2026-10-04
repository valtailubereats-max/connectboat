export type ArchiveStateRecord = {
  isArchived?: boolean;
  status?: string | null;
  adStatus?: string | null;
  archivedAt?: unknown;
};

// isArchived is the canonical current-state flag. Status-based detection is
// retained only for legacy records that do not have the canonical field yet.
export const isCurrentlyArchived = (listing: ArchiveStateRecord | null | undefined): boolean => {
  if (!listing) return false;
  if (typeof listing.isArchived === 'boolean') return listing.isArchived;
  return listing.status === 'archived' || listing.adStatus === 'archived';
};
