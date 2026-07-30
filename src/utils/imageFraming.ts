import React from 'react';

export interface ImageFraming {
  x: number;
  y: number;
  zoom: number;
  imageUrl?: string;
}

export interface AdFramingSource {
  imageUrl?: string;
  images?: string[];
  imagePositionX?: number;
  imagePositionY?: number;
  imageZoom?: number;
  coverImageSettings?: {
    imageUrl?: string;
    x?: number;
    y?: number;
    zoom?: number;
  };
  listingType?: string;
}

/**
 * Extracts and normalizes framing metadata from an ad or framing object.
 * Legacy ads without metadata safely fall back to { x: 50, y: 50, zoom: 1 }.
 */
export const getAdFraming = (ad?: AdFramingSource | null): ImageFraming => {
  if (!ad) {
    return { x: 50, y: 50, zoom: 1 };
  }

  const cover = ad.coverImageSettings;
  const currentCoverUrl = ad.imageUrl || (ad.images && ad.images[0]) || '';

  // Check if coverImageSettings exists and matches current cover URL (or if imageUrl is omitted in cover)
  if (cover && typeof cover === 'object') {
    const coverMatches = !cover.imageUrl || !currentCoverUrl || cover.imageUrl === currentCoverUrl;
    if (coverMatches) {
      const x = typeof cover.x === 'number' && !isNaN(cover.x) ? Math.min(100, Math.max(0, cover.x)) : (typeof ad.imagePositionX === 'number' && !isNaN(ad.imagePositionX) ? Math.min(100, Math.max(0, ad.imagePositionX)) : 50);
      const y = typeof cover.y === 'number' && !isNaN(cover.y) ? Math.min(100, Math.max(0, cover.y)) : (typeof ad.imagePositionY === 'number' && !isNaN(ad.imagePositionY) ? Math.min(100, Math.max(0, ad.imagePositionY)) : 50);
      const zoom = typeof cover.zoom === 'number' && !isNaN(cover.zoom) ? Math.min(3, Math.max(1, cover.zoom)) : (typeof ad.imageZoom === 'number' && !isNaN(ad.imageZoom) ? Math.min(3, Math.max(1, ad.imageZoom)) : 1);
      return { x, y, zoom, imageUrl: cover.imageUrl || currentCoverUrl };
    }
  }

  // Fallback to top-level fields
  const x = typeof ad.imagePositionX === 'number' && !isNaN(ad.imagePositionX) ? Math.min(100, Math.max(0, ad.imagePositionX)) : 50;
  const y = typeof ad.imagePositionY === 'number' && !isNaN(ad.imagePositionY) ? Math.min(100, Math.max(0, ad.imagePositionY)) : 50;
  const zoom = typeof ad.imageZoom === 'number' && !isNaN(ad.imageZoom) ? Math.min(3, Math.max(1, ad.imageZoom)) : 1;

  return { x, y, zoom, imageUrl: currentCoverUrl };
};

export interface FramingStyleOptions {
  isHovered?: boolean;
  hoverScaleMultiplier?: number;
  listingType?: string;
}

/**
 * Computes identical CSS styles for editor preview and public cards.
 */
export const getCardFramingStyle = (
  framingInput: ImageFraming | AdFramingSource | null | undefined,
  options: FramingStyleOptions = {}
): React.CSSProperties => {
  const { isHovered = false, hoverScaleMultiplier = 1.08, listingType } = options;

  if (listingType === 'informativo') {
    return {
      objectPosition: 'center',
      transform: `scale(${isHovered ? 1.03 : 1})`,
    };
  }

  const framing = (framingInput && 'x' in framingInput && 'y' in framingInput && 'zoom' in framingInput)
    ? (framingInput as ImageFraming)
    : getAdFraming(framingInput as AdFramingSource);

  const { x, y, zoom } = framing;
  const hoverScale = isHovered ? hoverScaleMultiplier : 1;
  const finalScale = zoom * hoverScale;

  const translateX = zoom > 1 ? ((x - 50) * (zoom - 1)) / zoom : 0;
  const translateY = zoom > 1 ? ((y - 50) * (zoom - 1)) / zoom : 0;

  return {
    objectPosition: `${x}% ${y}%`,
    transform: `scale(${finalScale}) translate(${translateX}%, ${translateY}%)`,
  };
};

/**
 * Development runtime diagnostic logging helper
 */
export const logFramingDiagnostic = (stage: string, data: any) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Framing Diagnostic - ${stage}]`, data);
  }
};
