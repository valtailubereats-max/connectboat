export interface SupportedMarketplace {
  id: string;
  name: string;
  domains: string[];
}

export const SUPPORTED_MARKETPLACES: SupportedMarketplace[] = [
  {
    id: 'gumtree',
    name: 'Gumtree',
    domains: ['gumtree.com', 'gumtree.co.uk']
  },
  {
    id: 'olx',
    name: 'OLX',
    domains: ['olx.pt']
  },
  {
    id: 'boatsandoutboards',
    name: 'Boats and Outboards',
    domains: ['boatsandoutboards.co.uk']
  },
  {
    id: 'apolloduck',
    name: 'Apollo Duck',
    domains: ['apolloduck.com', 'apolloduck.co.uk', 'apolloduck.ie']
  },
  {
    id: 'yachtworld',
    name: 'YachtWorld',
    domains: ['yachtworld.com', 'yachtworld.co.uk']
  },
  {
    id: 'rightboat',
    name: 'Rightboat',
    domains: ['rightboat.com']
  },
  {
    id: 'theyachtmarket',
    name: 'TheYachtMarket',
    domains: ['theyachtmarket.com']
  },
  {
    id: 'boatshop24',
    name: 'Boatshop24',
    domains: ['boatshop24.com']
  },
  {
    id: 'boat24',
    name: 'Boat24',
    domains: ['boat24.com']
  },
  {
    id: 'boats',
    name: 'Boats.com',
    domains: ['boats.com']
  }
];

export function getSupportedMarketplace(rawUrl: string): SupportedMarketplace | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  // Allow only http: and https: protocols
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  // Normalize hostname: lowercase, remove leading www., remove trailing dot
  let hostname = parsed.hostname.toLowerCase();
  if (hostname.endsWith('.')) {
    hostname = hostname.slice(0, -1);
  }
  if (hostname.startsWith('www.')) {
    hostname = hostname.slice(4);
  }

  for (const m of SUPPORTED_MARKETPLACES) {
    for (const domain of m.domains) {
      const normDomain = domain.toLowerCase();
      // Match exact domain or valid subdomain
      if (hostname === normDomain || hostname.endsWith(`.${normDomain}`)) {
        return m;
      }
    }
  }

  return null;
}

export function isValidMarketplaceUrl(rawUrl: string): boolean {
  return getSupportedMarketplace(rawUrl) !== null;
}

export function getSupportedMarketplacesMessage(): string {
  const names = SUPPORTED_MARKETPLACES.map(m => m.name);
  const last = names.pop();
  return `Unsupported marketplace. Supported sources include ${names.join(', ')} and ${last}.`;
}

export function getSourceSiteFromUrl(rawUrl: string): string {
  const marketplace = getSupportedMarketplace(rawUrl);
  if (marketplace) {
    return marketplace.name;
  }

  try {
    const parsed = new URL(rawUrl.trim());
    let hostname = parsed.hostname.toLowerCase();
    if (hostname.startsWith('www.')) hostname = hostname.slice(4);
    return hostname;
  } catch {
    return 'External';
  }
}
