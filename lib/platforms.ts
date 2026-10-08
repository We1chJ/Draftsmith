// Publishing limits per platform. Shown as a lookup card in the editor and used for enforcement.
// LinkedIn figures come from the Posts, Images and MultiImage API docs (learn.microsoft.com/linkedin).

export type Limit = { label: string; value: string; note?: string };

export const LINKEDIN = {
  key: "linkedin",
  name: "LinkedIn",
  postMaxChars: 3000,
  previewChars: 210, // roughly where the feed cuts to "…see more"; depends on device width
  maxImages: 20,
  imageMimes: ["image/jpeg", "image/png", "image/gif"],
  imageMaxBytes: 10 * 1024 * 1024, // our cap; LinkedIn limits by pixels, not bytes
  imageMaxPixels: 36_152_320,
  altTextMaxChars: 4086,
  limits: [
    { label: "Post text", value: "3,000 characters" },
    { label: "Shown before “see more”", value: "about 210 characters or 3 lines", note: "Varies by device" },
    { label: "Images per post", value: "1, or 2–20 as a gallery" },
    { label: "Image formats", value: "JPG, PNG, GIF (up to 250 frames)" },
    { label: "Image size", value: "under 36.2 megapixels", note: "e.g. 6000 × 6000" },
    { label: "Alt text", value: "up to 4,086 characters", note: "Keep under 120" },
    { label: "Comment", value: "1,250 characters" },
    { label: "Profile headline", value: "220 characters" },
    { label: "Profile about", value: "2,600 characters" },
  ] satisfies Limit[],
} as const;

export const PLATFORMS = [LINKEDIN] as const;
