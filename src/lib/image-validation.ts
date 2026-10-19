export const maxStoryImageBytes = 8 * 1024 * 1024;
const imageExtensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

export function storyImageExtension(mimeType: string) { return imageExtensions[mimeType]; }

export function validStoryImageHeader(mimeType: string, fileSize: number, bytes: number[]) {
  if (!storyImageExtension(mimeType) || !Number.isInteger(fileSize) || fileSize < 1 || fileSize > maxStoryImageBytes || bytes.length < 12 || bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) return false;
  const header = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return mimeType === "image/jpeg" ? header.startsWith("ffd8ff")
    : mimeType === "image/png" ? header.startsWith("89504e470d0a1a0a")
      : mimeType === "image/gif" ? header.startsWith("474946383761") || header.startsWith("474946383961")
        : header.startsWith("52494646") && header.slice(16, 24) === "57454250";
}
