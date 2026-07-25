import { mkdir, writeFile, unlink, stat } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

/**
 * Where uploaded media lives. Defaults to `public/uploads` for local
 * development; in Docker this points at a mounted volume so images survive
 * container rebuilds. Files are served back through /api/media/<filename>,
 * which works identically in dev and in the standalone production server.
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads');

export const MAX_UPLOAD_BYTES = Number.parseInt(process.env.MAX_UPLOAD_MB || '12', 10) * 1024 * 1024;

export const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

export interface StoredFile {
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
}

export async function ensureUploadDir(): Promise<void> {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

function safeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'image';
}

/** Reject anything that could escape the upload directory. */
export function resolveUploadPath(filename: string): string | null {
  if (!filename || filename.includes('\0')) return null;
  const base = path.basename(filename);
  if (base !== filename || base === '.' || base === '..') return null;
  const resolved = path.resolve(UPLOAD_DIR, base);
  if (!resolved.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) return null;
  return resolved;
}

/**
 * Optimise and persist an image.
 *
 * Large photographs are downscaled and converted to WebP, which typically
 * cuts a 4 MB camera JPEG to a few hundred KB. If sharp is unavailable for the
 * running platform the original bytes are written instead — a slower page is
 * better than a failed upload.
 */
export async function storeImage(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  options: { maxWidth?: number; folder?: string } = {},
): Promise<StoredFile> {
  await ensureUploadDir();

  const slug = safeSlug(originalName);
  const unique = randomUUID().slice(0, 8);
  const maxWidth = options.maxWidth ?? 2400;

  // SVG and GIF are passed through: rasterising them would lose what makes them useful.
  const passthrough = mimeType === 'image/svg+xml' || mimeType === 'image/gif';

  if (!passthrough) {
    try {
      const sharpModule = (await import('sharp')).default;
      const pipeline = sharpModule(buffer, { failOn: 'none' }).rotate();
      const metadata = await pipeline.metadata();
      const resized =
        metadata.width && metadata.width > maxWidth ? pipeline.resize({ width: maxWidth }) : pipeline;
      const output = await resized.webp({ quality: 82 }).toBuffer({ resolveWithObject: true });

      const filename = `${slug}-${unique}.webp`;
      await writeFile(path.join(UPLOAD_DIR, filename), output.data);
      return {
        filename,
        url: `/api/media/${filename}`,
        mimeType: 'image/webp',
        size: output.data.length,
        width: output.info.width,
        height: output.info.height,
      };
    } catch (error) {
      console.warn('Image optimisation unavailable, storing original:', error);
    }
  }

  const extension = ALLOWED_MIME[mimeType] || 'bin';
  const filename = `${slug}-${unique}.${extension}`;
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return { filename, url: `/api/media/${filename}`, mimeType, size: buffer.length };
}

export async function deleteStoredFile(filename: string): Promise<boolean> {
  const target = resolveUploadPath(filename);
  if (!target) return false;
  try {
    await unlink(target);
    return true;
  } catch {
    return false;
  }
}

export async function fileExists(filename: string): Promise<boolean> {
  const target = resolveUploadPath(filename);
  if (!target) return false;
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}
