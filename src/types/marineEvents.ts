export type MarineEventPlan = 'standard' | 'featured' | 'premium';
export type MarineEventCategory = 'Boat Shows' | 'Regattas' | 'Marine Events' | 'Festivals' | 'Other';
export type ExternalEventReviewStatus = 'pending' | 'approved' | 'rejected';

export type ExternalEventSource = {
  sourceName: string;
  sourceUrl: string;
  externalId: string;
};

export type ExternalEventCandidate = {
  id: string;
  title: string;
  startDate: string;
  endDate?: string;
  country: string;
  city: string;
  venue: string;
  category: MarineEventCategory;
  website?: string;
  ticketUrl?: string;
  source: 'imported';
  sourceName: string;
  sourceUrl: string;
  externalId: string;
  externalSources: ExternalEventSource[];
  reviewStatus: ExternalEventReviewStatus;
  dedupeKey: string;
  normalizedTitle: string;
  normalizedCity: string;
  normalizedVenue: string;
  canonicalWebsite: string;
  possibleDuplicateOf?: string;
  duplicateConfidence?: number;
  firstFoundAt?: unknown;
  lastCheckedAt?: unknown;
  lastSeenAt?: unknown;
  reviewedAt?: unknown;
  reviewedBy?: string;
  rejectionReason?: string;
  publishedEventId?: string;
  adminEditedFields?: string[];
};

