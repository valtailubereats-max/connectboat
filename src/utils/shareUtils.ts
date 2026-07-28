import { formatPrice } from '../utils';

export interface ShareOptions {
  type: 'home' | 'anuncio' | 'vitrine' | 'links' | 'sorteio' | 'generic';
  title?: string;
  price?: number;
  country?: string;
  city?: string;
  description?: string;
  prize?: string;
  url?: string;
}

export function generateShareText(options: ShareOptions): { text: string; url: string; title: string } {
  const baseOrigin = window.location.origin;
  const officialHomeUrl = 'https://www.connectboat.co.uk';
  
  let shareUrl = options.url || window.location.href;
  let title = options.title || 'ConnectBoat';
  let formattedText = '';

  switch (options.type) {
    case 'home':
      title = 'ConnectBoat';
      formattedText = `⛵ Discover ConnectBoat\n\nThe UK's premier boat and marine marketplace to buy, sell, charter, and browse nautical services.`;
      shareUrl = officialHomeUrl;
      break;

    case 'anuncio':
      const priceText = (options.price !== undefined && options.price !== null)
        ? formatPrice(options.price, options.country)
        : '';
      
      formattedText = `📢 *${options.title || 'Listing'}*\n`;
      if (priceText && priceText !== 'Free') {
        formattedText += `💰 Price: ${priceText}\n`;
      }
      if (options.city) {
        formattedText += `📍 Location: ${options.city}\n`;
      }
      formattedText += `\nCheck out full details on ConnectBoat:`;
      break;

    case 'vitrine':
      formattedText = `🛍️ *${options.title || 'Digital Showcase'}*\n`;
      if (options.description) {
        formattedText += `📝 ${options.description}\n`;
      }
      formattedText += `\nView our marine showcase on ConnectBoat:`;
      break;

    case 'links':
      formattedText = `ℹ️ *${options.title || 'Useful Links'}*\n`;
      if (options.description) {
        formattedText += `📝 ${options.description}\n`;
      }
      formattedText += `\nAccess directly via ConnectBoat:`;
      break;

    case 'sorteio':
      formattedText = `🍀 Giveaway: *${options.title || 'Free Giveaway'}*\n`;
      if (options.prize) {
        formattedText += `🎁 Prize: ${options.prize}\n`;
      }
      formattedText += `\nEnter for free on ConnectBoat:`;
      break;

    default:
      formattedText = options.description || `Check it out on ConnectBoat!`;
      break;
  }

  return {
    text: formattedText,
    url: shareUrl,
    title
  };
}

export function triggerShare(options: ShareOptions): void {
  const event = new CustomEvent('open-share-modal', { detail: options });
  window.dispatchEvent(event);
}
