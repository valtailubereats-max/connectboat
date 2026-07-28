import imageCompression from 'browser-image-compression';

/**
 * Resizes and compresses an image before upload using browser-image-compression.
 * @param file The original image file.
 * @param maxWidth Maximum width in pixels.
 * @param quality Compression quality (0 to 1). Note: browser-image-compression uses initialQuality.
 * @returns A promise that resolves to a Blob of the compressed image.
 */
export async function compressImage(file: File, maxWidth: number = 1200, quality: number = 0.8): Promise<File | Blob> {
  const options = {
    maxWidthOrHeight: maxWidth,
    useWebWorker: true,
    initialQuality: quality,
  };

  try {
    const compressedFile = await imageCompression(file, options);
    return compressedFile;
  } catch (error) {
    console.error('Compression failed, using original file:', error);
    return file;
  }
}
