export type ListingPlan = 'standard' | 'featured' | 'premium';

export type PlanDurationSettings = {
  planDurations?: Partial<Record<ListingPlan | 'free' | 'local' | 'national' | 'intermediate' | 'marketplace' | 'service', unknown>>;
};

export const DEFAULT_PLAN_DURATION_DAYS = 30;
const MARKETPLACE_CATEGORIES = new Set([
  'Boat Parts', 'Boat Engines', 'Marine Electronics', 'Trailers',
  'Marinas', 'Accessories', 'Wanted',
]);

export function normalizeListingPlan(plan: unknown): ListingPlan {
  const value = String(plan || 'standard').toLowerCase();
  if (value === 'premium' || value === 'national') return 'premium';
  if (['featured', 'highlight', 'local', 'intermediate'].includes(value)) return 'featured';
  return 'standard';
}

export function getPlanDurationDays(
  settings: PlanDurationSettings | null | undefined,
  plan: unknown,
  category?: string,
  explicitDurationDays?: unknown,
): number {
  const explicit = Number(explicitDurationDays);
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit);

  const durations = settings?.planDurations;
  const normalizedPlan = normalizeListingPlan(plan);

  // Boat Services has one Admin-controlled duration shared by Basic,
  // Featured and Premium. Explicit benefit durations still take precedence.
  if (category === 'Boat Services') {
    const serviceDays = Number(durations?.service);
    if (Number.isFinite(serviceDays) && serviceDays > 0) return Math.round(serviceDays);
    return DEFAULT_PLAN_DURATION_DAYS;
  }

  const categoryKey = MARKETPLACE_CATEGORIES.has(category || '') ? 'marketplace' : null;

  // Existing category-specific duration keys are honoured when present.
  const categoryDuration = categoryKey
    ? Number((durations as Record<string, unknown> | undefined)?.[categoryKey])
    : NaN;
  if (Number.isFinite(categoryDuration) && categoryDuration > 0) return Math.round(categoryDuration);


  const aliases: Record<ListingPlan, string[]> = {
    standard: ['standard', 'free'],
    featured: ['featured', 'local', 'intermediate'],
    premium: ['premium', 'national'],
  };
  for (const key of aliases[normalizedPlan]) {
    const value = Number(durations?.[key as keyof NonNullable<typeof durations>]);
    if (Number.isFinite(value) && value > 0) return Math.round(value);
  }
  return DEFAULT_PLAN_DURATION_DAYS;
}

export function addPlanDuration(start: Date, durationDays: number): Date {
  const result = new Date(start);
  result.setDate(result.getDate() + durationDays);
  return result;
}
