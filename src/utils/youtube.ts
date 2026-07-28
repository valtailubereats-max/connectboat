export const extractYoutubeId = (url: string): string | null => {
  if (!url) return null;
  
  // Support watch?v=, youtu.be, shorts, embeds
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  
  if (match && match[2] && match[2].length === 11) {
    return match[2];
  }
  
  // Extra check for simple shorts URLs: youtube.com/shorts/ID
  if (url.includes('/shorts/')) {
    const parts = url.split('/shorts/');
    if (parts.length > 1) {
      const subParts = parts[1].split(/[?#&]/);
      if (subParts[0] && subParts[0].length === 11) {
        return subParts[0];
      }
    }
  }
  
  return null;
};

export interface YoutubeMetadata {
  videoId: string;
  thumbnailUrl: string;
  title: string;
  channelName: string;
  channelUrl: string;
  channelId: string | null;
}

export const fetchYoutubeMetadata = async (url: string): Promise<YoutubeMetadata> => {
  const videoId = extractYoutubeId(url);
  if (!videoId) {
    throw new Error('URL do YouTube inválido.');
  }

  // Use YouTube's public oEmbed API which supports CORS
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${videoId}`
  )}&format=json`;

  try {
    const response = await fetch(oembedUrl);
    if (!response.ok) {
      throw new Error('Falha ao obter metadados do YouTube.');
    }
    const data = await response.json();
    return {
      videoId,
      thumbnailUrl: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      title: data.title || 'Vídeo do YouTube',
      channelName: data.author_name || 'Canal do YouTube',
      channelUrl: data.author_url || `https://www.youtube.com`,
      channelId: null, // oEmbed doesn't return channelId, but we can store null/empty
    };
  } catch (error) {
    console.error('Erro ao buscar oembed:', error);
    // Return fallback metadata derived from URL/ID if oEmbed request fails
    return {
      videoId,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      title: 'Vídeo do YouTube',
      channelName: 'Canal do YouTube',
      channelUrl: `https://www.youtube.com`,
      channelId: null,
    };
  }
};
