"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { site } from "@/lib/site-config";
import { PhoneIcon } from "./Icons";
import styles from "./SiteHeader.module.css";

const navLinks = [
  { href: "#services", label: "Services" },
  { href: "#process", label: "How It Works" },
  { href: "#reviews", label: "Reviews" },
  { href: "#contact", label: "Contact" },
];

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ""}`}>
      <div className={`container ${styles.bar}`}>
        <a href="#top" className={styles.brand} aria-label={site.name}>
          <Image
            src="/brand/logo.png"
            alt={site.name}
            width={1200}
            height={805}
            className={styles.logo}
            priority
          />
        </a>

        <nav className={styles.nav} aria-label="Primary">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className={styles.link}>
              {l.label}
            </a>
          ))}
        </nav>

        <div className={styles.actions}>
          <a
            href={site.phoneHref}
            className={styles.phone}
            aria-label={`Call ${site.phoneDisplay}`}
          >
            <PhoneIcon />
            <span className={styles.phoneNum}>{site.phoneDisplay}</span>
          </a>
          <a href="#booking" className={`btn ${styles.cta}`}>
            Book Now
          </a>
          <button
            className={styles.menuBtn}
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className={`${styles.menuLine} ${open ? styles.menuLineOpen1 : ""}`} />
            <span className={`${styles.menuLine} ${open ? styles.menuLineHidden : ""}`} />
            <span className={`${styles.menuLine} ${open ? styles.menuLineOpen2 : ""}`} />
          </button>
        </div>
      </div>

      <div className={`${styles.mobile} ${open ? styles.mobileOpen : ""}`}>
        {navLinks.map((l) => (
          <a key={l.href} href={l.href} className={styles.mobileLink} onClick={() => setOpen(false)}>
            {l.label}
          </a>
        ))}
        <a href={site.phoneHref} className={styles.mobileLink}>
          {site.phoneDisplay}
        </a>
        <a href="#booking" className={`btn btn--block ${styles.mobileCta}`} onClick={() => setOpen(false)}>
          Book Now
        </a>
      </div>
    </header>
  );
}
