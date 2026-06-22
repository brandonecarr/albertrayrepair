import Image from "next/image";
import { site } from "@/lib/site-config";
import { CheckIcon } from "./Icons";
import Reveal from "./Reveal";
import styles from "./About.module.css";

const promises = [
  "On-time arrival — your time matters",
  "Honest, upfront estimates before work starts",
  "Job site left cleaner than we found it",
  "Quality materials and craftsman-grade work",
  "Satisfaction guaranteed on every visit",
];

export default function About() {
  return (
    <section id="about" className={`section section--bone2 ${styles.section}`}>
      <div className={`container ${styles.inner}`}>
        <Reveal className={styles.visual}>
          <div className={styles.card}>
            <Image
              src="/brand/badge.svg"
              alt={site.name}
              width={180}
              height={165}
              className={styles.badge}
            />
            <p className={styles.cardName}>{site.name}</p>
            <div className={styles.seal}>
              <span className={styles.sealTop}>Satisfaction</span>
              <span className={styles.sealBig}>100%</span>
              <span className={styles.sealBottom}>Guaranteed</span>
            </div>
          </div>
        </Reveal>

        <div className={styles.content}>
          <Reveal as="p" className="eyebrow">
            Meet Albert
          </Reveal>
          <Reveal as="h2" className="h-lg" delay={60}>
            Built on trust,
            <br />
            <span className="accent">not upsells.</span>
          </Reveal>
          <Reveal delay={120}>
            <p className={`lead ${styles.lead}`}>
              Across {site.serviceArea.region}, Albert Ray has earned a perfect
              5-star reputation for one simple thing: showing up when he says he
              will and doing the job right. A plumbing and carpentry specialist, he
              tracks down the real problem, gives an honest estimate up front, and
              backs his work&mdash;no corner-cutting, no surprise charges. Guided
              by his Christian faith, he treats every customer the way he&rsquo;d
              want to be treated.
            </p>
          </Reveal>

          <ul className={styles.list}>
            {promises.map((p, i) => (
              <Reveal as="li" key={p} delay={140 + i * 70} className={styles.item}>
                <CheckIcon className={styles.check} />
                {p}
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
