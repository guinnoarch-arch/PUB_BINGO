export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 1600;

export function validatePhotoFile(file) {
  if (!file) return "Choose a photo first.";
  if (!PHOTO_TYPES.includes(file.type)) return "Only JPEG, PNG or WebP images can be uploaded.";
  if (file.size > 20 * 1024 * 1024) return "That photo is too large (max 20 MB before resizing).";
  return null;
}

// Resizes to at most 1600px and re-encodes as JPEG. This keeps uploads small (free storage tier)
// and strips EXIF metadata, including GPS location, from phone photos.
export async function preparePhoto(file) {
  const error = validatePhotoFile(file);
  if (error) throw new Error(error);
  if (typeof createImageBitmap !== "function") return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("Couldn't process that image.");
  if (blob.size > PHOTO_MAX_BYTES) throw new Error("That photo is still over 5 MB after resizing.");
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

export function photoPath(pubId, userId) {
  const random = Math.random().toString(36).slice(2, 10);
  return `${pubId}/${userId}/${Date.now()}-${random}.jpg`;
}
