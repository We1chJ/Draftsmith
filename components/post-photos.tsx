/* eslint-disable @next/next/no-img-element */
import type { PostImage } from "@/lib/types";

// Photos under a post, laid out roughly like the LinkedIn feed: one big, then a row of up to three,
// with "+N" on the last tile when there are more.
export function PostPhotos({ images }: { images: PostImage[] }) {
  if (images.length === 0) return null;

  if (images.length === 1) {
    const [img] = images;
    return (
      <div className="overflow-hidden rounded-[10px] border border-line bg-paper">
        <img src={img.url} alt={img.alt ?? ""} className="max-h-[520px] w-full object-contain" />
      </div>
    );
  }

  if (images.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-1 overflow-hidden rounded-[10px] border border-line">
        {images.map((img) => (
          <img key={img.id} src={img.url} alt={img.alt ?? ""} className="aspect-square w-full object-cover" />
        ))}
      </div>
    );
  }

  const [first, ...rest] = images;
  const shown = rest.slice(0, 3);
  const extra = rest.length - shown.length;
  return (
    <div className="space-y-1 overflow-hidden rounded-[10px] border border-line">
      <img src={first.url} alt={first.alt ?? ""} className="aspect-[16/10] w-full object-cover" />
      <div className={`grid gap-1 ${shown.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {shown.map((img, i) => (
          <div key={img.id} className="relative">
            <img src={img.url} alt={img.alt ?? ""} className="aspect-square w-full object-cover" />
            {extra > 0 && i === shown.length - 1 && (
              <span className="absolute inset-0 grid place-items-center bg-ink/55 font-display text-[22px] font-semibold text-paper">
                +{extra}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
