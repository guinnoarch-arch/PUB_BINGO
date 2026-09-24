// Menus and price photos sent in by users (Suggestions → Menu or price). Only admins see them.
export const MENU_FILE_MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
// Menus need to stay readable, so photos are kept bigger than pub photos.
const MAX_DIMENSION = 2400;

export function isPdf(file) {
  return file?.type === "application/pdf" || /\.pdf$/i.test(file?.name || "");
}

export function validateMenuSubmissionFile(file) {
  if (!file) return "Choose a PDF or a photo first.";
  if (!isPdf(file) && !String(file.type || "").startsWith("image/")) return "Send a PDF or a photo.";
  if (isPdf(file) && file.size > MENU_FILE_MAX_BYTES) return "That PDF is over 10 MB.";
  if (!isPdf(file) && file.size > 25 * 1024 * 1024) return "That photo is too large (max 25 MB).";
  return null;
}

// Photos are resized and re-encoded as JPEG, which also strips location data from phone photos
// (and converts formats like HEIC where the browser can read them).
export async function prepareMenuFile(file) {
  const problem = validateMenuSubmissionFile(file);
  if (problem) throw new Error(problem);
  if (isPdf(file)) return { file, ext: "pdf", contentType: "application/pdf" };
  if (typeof createImageBitmap !== "function") {
    if (!IMAGE_TYPES.includes(file.type)) throw new Error("Send the photo as a JPEG, PNG or WebP.");
    if (file.size > MENU_FILE_MAX_BYTES) throw new Error("That photo is over 10 MB.");
    return { file, ext: file.type.split("/")[1].replace("jpeg", "jpg"), contentType: file.type };
  }
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Couldn't read that photo. Try a JPEG or PNG.");
  }
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!blob) throw new Error("Couldn't process that photo.");
  if (blob.size > MENU_FILE_MAX_BYTES) throw new Error("That photo is still over 10 MB after resizing.");
  return { file: new File([blob], "menu.jpg", { type: "image/jpeg" }), ext: "jpg", contentType: "image/jpeg" };
}

export function menuSubmissionPath(userId, ext) {
  const random = Math.random().toString(36).slice(2, 10);
  return `${userId}/${Date.now()}-${random}.${ext}`;
}

// Today's date in London as YYYY-MM-DD (for the "date seen" fields).
export function londonToday(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function validateSeenOn(value, today = londonToday()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "Add the date you saw the menu.";
  if (value > today) return "The date can't be in the future.";
  const yearAgo = new Date(`${today}T12:00:00Z`);
  yearAgo.setUTCDate(yearAgo.getUTCDate() - 365);
  if (value < yearAgo.toISOString().slice(0, 10)) return "That menu is over a year old, so the prices are probably out of date.";
  return null;
}
