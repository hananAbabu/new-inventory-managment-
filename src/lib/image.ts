/**
 * Transfer slips are photographed on a phone — several megabytes each — but the
 * whole workspace lives in localStorage, which holds about 5 MB in total. Every
 * slip is therefore downscaled and re-encoded as JPEG before it is stored.
 */

const MAX_DIMENSION = 1000;
const QUALITY = 0.7;

/** Refuse anything that would still eat a meaningful slice of the quota. */
export const MAX_SLIP_BYTES = 400_000;

/** Rough decoded size of a data URL, which is what localStorage will hold. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const body = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.floor((body.length * 3) / 4);
}

export function formatBytes(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.round(n / 1000)} KB`;
}

/** Downscales to fit MAX_DIMENSION and returns a JPEG data URL. */
export async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('That file is not an image.');
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not read the image.');

    // JPEG has no alpha; paint white so transparent screenshots do not go black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    return canvas.toDataURL('image/jpeg', QUALITY);
  } finally {
    bitmap.close();
  }
}
