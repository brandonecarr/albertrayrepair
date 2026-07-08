import fs from "node:fs";
import path from "node:path";
import Reveal from "./Reveal";
import WorkGallery, { type WorkImage } from "./WorkGallery";
import { listPublicWorkPhotos } from "@/lib/work-photos";
import styles from "./Work.module.css";

const IMAGE_RE = /\.(jpe?g|png|webp|avif)$/i;
const BRAND = "Albert Ray's Repairs & Restoration";

/** Turn a filename stem into a readable label (fallback alt text). */
function prettify(stem: string): string {
  return stem
    .replace(/^\d+[-_ ]*/, "") // drop leading ordering digits
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Images committed to public/brand/work (the folder drop-in path). */
function getFolderImages(): WorkImage[] {
  try {
    const dir = path.join(process.cwd(), "public", "brand", "work");
    return fs
      .readdirSync(dir)
      .filter((f) => IMAGE_RE.test(f))
      .sort()
      .map((file) => {
        const stem = file.replace(IMAGE_RE, "");
        const [key, caption] = stem.split(" -- ");
        return {
          src: `/brand/work/${file}`,
          caption: caption?.trim() || null,
          alt: `${caption?.trim() || prettify(key) || "Albert Ray's work"} — ${BRAND}`,
        };
      });
  } catch {
    return [];
  }
}

/**
 * The full gallery: photos Albert uploaded from the admin (stored in blob,
 * listed from the DB) followed by any images committed to public/brand/work.
 * Both sources work; the section hides itself when there are none.
 */
export async function getGalleryImages(): Promise<WorkImage[]> {
  const uploaded = (await listPublicWorkPhotos()).map((p) => ({
    src: p.url,
    caption: p.caption,
    alt: `${p.caption || "Albert Ray's work"} — ${BRAND}`,
  }));
  return [...uploaded, ...getFolderImages()];
}

export default function Work({ images }: { images: WorkImage[] }) {
  if (images.length === 0) return null;

  return (
    <section id="work" className={`section section--ink grain ${styles.section}`}>
      <div className={`tex-grid--ink ${styles.grid}`} aria-hidden />
      <div className="container">
        <div className={styles.head}>
          <Reveal as="p" className="eyebrow eyebrow--center">
            Our Work
          </Reveal>
          <Reveal as="h2" className="h-lg" delay={60}>
            Craftsmanship you can <span className="accent">see.</span>
          </Reveal>
          <Reveal as="p" className={styles.sub} delay={110}>
            A look at recent repairs and restorations around Apple Valley and the
            High Desert.
          </Reveal>
        </div>

        <WorkGallery images={images} />
      </div>
    </section>
  );
}
