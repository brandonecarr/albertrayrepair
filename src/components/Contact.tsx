import { site } from "@/lib/site-config";
import { ClockIcon, MailIcon, PhoneIcon, PinIcon } from "./Icons";
import LeadForm from "./LeadForm";
import styles from "./Contact.module.css";

export default function Contact() {
  return (
    <section id="contact" className={`section ${styles.section}`}>
      <div className={`container ${styles.inner}`}>
        {/* info */}
        <div className={styles.info}>
          <p className="eyebrow">Get In Touch</p>
          <h2 className="h-lg">
            Questions? <span className="accent">Just ask.</span>
          </h2>
          <p className={styles.infoLead}>
            Call or text for a fast answer, or send a quick message and Albert will get
            right back to you.
          </p>

          <ul className={styles.contactList}>
            <li className={styles.contactItem}>
              <span className={styles.ci}>
                <PhoneIcon />
              </span>
              <div>
                <span className={styles.ciLabel}>Call or Text</span>
                <a href={site.phoneHref} className={styles.ciValue}>
                  {site.phoneDisplay}
                </a>
              </div>
            </li>
            <li className={styles.contactItem}>
              <span className={styles.ci}>
                <MailIcon />
              </span>
              <div>
                <span className={styles.ciLabel}>Email</span>
                <a href={`mailto:${site.email}`} className={styles.ciValue}>
                  {site.email}
                </a>
              </div>
            </li>
            <li className={styles.contactItem}>
              <span className={styles.ci}>
                <PinIcon />
              </span>
              <div>
                <span className={styles.ciLabel}>Service Area</span>
                <span className={styles.ciValue}>{site.serviceArea.nearby.join(" · ")}</span>
              </div>
            </li>
            <li className={styles.contactItem}>
              <span className={styles.ci}>
                <ClockIcon />
              </span>
              <div>
                <span className={styles.ciLabel}>Hours</span>
                <span className={styles.ciValueSmall}>
                  {site.hours.map((h) => (
                    <span key={h.day}>
                      {h.day}: {h.time}
                    </span>
                  ))}
                </span>
              </div>
            </li>
          </ul>
        </div>

        {/* form */}
        <LeadForm title="Send a Quick Message" cta="Send Message" />
      </div>
    </section>
  );
}
