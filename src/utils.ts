export const formatPrice = (price: number | undefined, country?: string): string => {
  if (price === undefined || price === null || price === 0) return 'Free';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
};

export const generateSlug = (title: string): string => {
  if (!title) return '';
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[-\s]+/g, '-');
};

export const getAdUrl = (ad: { id: string; title: string }): string => {
  const slug = generateSlug(ad.title);
  return `/anuncio/${slug ? `${slug}-` : ''}${ad.id}`;
};

export const extractIdFromSlug = (param: string | undefined): string => {
  if (!param) return '';
  const parts = param.split('-');
  return parts[parts.length - 1];
};

export const getAdLocationLabel = (ad: { category: string; city: string; country?: string; serviceCoverage?: string }): string => {
  const isService = ad.category === 'Marine Services' || ad.category?.toLowerCase() === 'marine services' || ad.category?.includes('Service');
  if (!isService) {
    return ad.city || 'United Kingdom';
  }
  const coverage = ad.serviceCoverage || 'city';
  switch (coverage) {
    case 'radius20':
      return `${ad.city} + 20 miles`;
    case 'radius50':
      return `${ad.city} + 50 miles`;
    case 'county':
      return `Region / County (${ad.city})`;
    case 'uk':
      return 'United Kingdom Nationwide';
    case 'online':
      return 'Online Service';
    case 'city':
    default:
      return ad.city || 'United Kingdom';
  }
};
