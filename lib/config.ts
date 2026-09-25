export const BUSINESS_UNITS = [
  { value: "renner", label: "Renner" },
  { value: "camicado", label: "Camicado" },
  { value: "ashua", label: "Ashua" },
  { value: "youcom", label: "Youcom" },
  { value: "repassa", label: "Repassa" },
  { value: "realize", label: "Realize" }
] as const;

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const NORMALIZED_PHOTO_SIZE = 1024;
export const NORMALIZED_PHOTO_QUALITY = 0.85;
export const MAX_INTENTION_LENGTH = 200;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export type Locale = "pt" | "es";
