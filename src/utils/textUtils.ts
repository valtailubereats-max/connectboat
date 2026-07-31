// Utility text processing functions for HTML decoding, string cleaning, and price parsing

export const decodeHtmlEntities = (str: string): string => {
  if (!str) return '';
  let temp = str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&pound;/g, '£')
    .replace(/&euro;/g, '€')
    .replace(/&#36;/g, '$')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  try {
    temp = temp.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  } catch (e) {
    // ignore
  }
  return temp;
};

export const cleanTitle = (title: string): string => {
  if (!title) return '';
  let temp = decodeHtmlEntities(title)
    .replace(/\s*-\s*à venda\s*-\s*.*$/gi, '')
    .replace(/\s*-\s*OLX\s*Portugal.*$/gi, '')
    .replace(/\s*-\s*OLX.*$/gi, '')
    .replace(/\s*[|]\s*Gumtree.*$/gi, '')
    .replace(/\s*-\s*Gumtree.*$/gi, '')
    .replace(/\s*in\s+[^|]+[|]\s*Gumtree.*$/gi, '')
    .replace(/\s*-\s*Boats\s*and\s*Outboards.*$/gi, '')
    .replace(/\s*-\s*Apollo\s*Duck.*$/gi, '')
    .replace(/\s*-\s*YachtWorld.*$/gi, '')
    .replace(/\s*-\s*Rightboat.*$/gi, '')
    .replace(/\s*-\s*TheYachtMarket.*$/gi, '')
    .replace(/\s*-\s*Boatshop24.*$/gi, '')
    .replace(/\s*-\s*Boat24.*$/gi, '')
    .replace(/\s*-\s*Boats\.com.*$/gi, '')
    .replace(/\|.*$/gi, '')
    .trim();

  // Remove emojis
  temp = temp.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
  
  // Replace duplicated spaces
  temp = temp.replace(/\s+/g, ' ');

  return temp.trim();
};

export const cleanDescription = (desc: string): string => {
  if (!desc) return '';
  let temp = decodeHtmlEntities(desc);
  
  temp = temp.replace(/<[^>]*>/g, '');
  temp = temp.replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '');
  temp = temp.replace(/\r/g, '');
  temp = temp.replace(/\n{3,}/g, '\n\n');
  temp = temp.split('\n').map(line => line.trim()).join('\n');
  temp = temp.split('\n').map(line => line.replace(/[ \t]{2,}/g, ' ')).join('\n');

  return temp.trim();
};

export const parsePrice = (priceStr: string | number | undefined | null): number => {
  if (priceStr === undefined || priceStr === null) return 0;
  if (typeof priceStr === 'number') return priceStr;
  
  let str = String(priceStr).trim();
  if (!str) return 0;

  str = str.replace(/[€$£\s]/g, '');

  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');
  
  if (lastComma > lastDot && (lastComma === str.length - 3 || lastComma === str.length - 2)) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma && (lastDot === str.length - 3 || lastDot === str.length - 2)) {
    str = str.replace(/,/g, '');
  } else {
    str = str.replace(/[,.]/g, '');
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};
