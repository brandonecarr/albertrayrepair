import Image from "next/image";
import { site } from "@/lib/site-config";
import { PhoneIcon, MailIcon, IchthysIcon } from "./Icons";
import styles from "./SiteFooter.module.css";

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className={styles.footer}>
      <div className="hazard" aria-hidden />
      <div className={`container ${styles.grid}`}>
        <div className={styles.brandCol}>
          <Image src="/brand/badge.svg" alt={site.name} width={64} height={59} />
          <p className={styles.brandName}>{site.name}</p>
          <p className={styles.tagline}>{site.tagline}</p>
          <p className={styles.faith}>
            <IchthysIcon className={styles.faithIcon} aria-hidden />
            Faith-driven, honest work
          </p>
        </div>

        <div className={styles.col}>
          <h4 className={styles.colHead}>Contact</h4>
          <a href={site.phoneHref} className={styles.link}>
            <PhoneIcon /> {site.phoneDisplay}
          </a>
          <a href={`mailto:${site.email}`} className={styles.link}>
            <MailIcon /> {site.email}
          </a>
        </div>

        <div className={styles.col}>
          <h4 className={styles.colHead}>Hours</h4>
          {site.hours.map((h) => (
            <p key={h.day} className={styles.hoursRow}>
              <span>{h.day}</span>
              <span>{h.time}</span>
            </p>
          ))}
        </div>

        <div className={styles.col}>
          <h4 className={styles.colHead}>Service Area</h4>
          <p className={styles.area}>
            Proudly serving {site.serviceArea.region}:
          </p>
          <p className={styles.areaList}>{site.serviceArea.nearby.join(" · ")}</p>
          <a href="#booking" className={`btn ${styles.footerCta}`}>
            Book a Visit
          </a>
        </div>
      </div>

      <div className={`container ${styles.bottom}`}>
        <p>
          &copy; {year} {site.name}. All rights reserved.
        </p>
        <p className={styles.badges}>{site.badges.join(" · ")}</p>
      </div>
    </footer>
  );
}
