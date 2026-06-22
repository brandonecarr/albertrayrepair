import { services, site } from "@/lib/site-config";
import { serviceIcons, ArrowIcon } from "./Icons";
import Reveal from "./Reveal";
import styles from "./Services.module.css";

export default function Services() {
  return (
    <section id="services" className={`section ${styles.section}`}>
      <div className="container">
        <div className={styles.head}>
          <div>
            <Reveal as="p" className="eyebrow">
              What Albert Fixes
            </Reveal>
            <Reveal as="h2" className="h-lg" delay={60}>
              One call. <span className="accent">Every</span> odd job handled.
            </Reveal>
          </div>
          <Reveal className={styles.headText} delay={120}>
            <p className="lead muted">
              From a single sticky door to a full punch list, Albert brings the right
              tools and a craftsman&rsquo;s eye to every visit across {site.serviceArea.region}.
            </p>
          </Reveal>
        </div>

        <div className={styles.grid}>
          {services.map((s, i) => {
            const Icon = serviceIcons[s.icon];
            return (
              <Reveal key={s.title} delay={(i % 3) * 80} className={styles.card}>
                <span className={styles.iconWrap}>
                  <Icon className={styles.icon} />
                </span>
                <h3 className={styles.cardTitle}>{s.title}</h3>
                <p className={styles.cardBlurb}>{s.blurb}</p>
                <span className={styles.index} aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </span>
              </Reveal>
            );
          })}
        </div>

        <Reveal className={styles.footer} delay={120}>
          <p className={styles.footerText}>
            Don&rsquo;t see your project? If it needs fixing, hanging, patching, or
            building&mdash;just ask.
          </p>
          <a href="#booking" className="btn">
            Get It On The List
            <ArrowIcon />
          </a>
        </Reveal>
      </div>
    </section>
  );
}
