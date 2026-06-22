"use client";

import { useState } from "react";
import { site } from "@/lib/site-config";
import { ArrowIcon, CheckIcon } from "./Icons";
import styles from "./LeadForm.module.css";

type Status = "idle" | "submitting" | "success" | "error";

type Props = {
  variant?: "panel" | "hero";
  title?: string;
  subtitle?: string;
  cta?: string;
};

export default function LeadForm({
  variant = "panel",
  title = "Send a Quick Message",
  subtitle,
  cta = "Send Message",
}: Props) {
  const [form, setForm] = useState({ name: "", contact: "", message: "", company: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [serverError, setServerError] = useState("");

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: "" }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Your name is required";
    if (!form.contact.trim()) e.contact = "A phone or email is required";
    if (form.message.trim().length < 5) e.message = "Tell us a little about the job";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setStatus("submitting");
    setServerError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong. Please call us instead.");
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setServerError(err instanceof Error ? err.message : "Unexpected error");
    }
  }

  const cardClass = `${styles.card} ${variant === "hero" ? styles.cardHero : styles.cardPanel}`;

  if (status === "success") {
    return (
      <div className={cardClass}>
        <div className={styles.success}>
          <span className={styles.successIcon}>
            <CheckIcon />
          </span>
          <h3 className="h-md">Message sent!</h3>
          <p className={styles.successText}>
            Thanks, {form.name.split(" ")[0]}. Albert got your note and will reach out
            soon. For anything urgent, call {site.phoneDisplay}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cardClass}>
      <form onSubmit={handleSubmit} noValidate className={styles.form}>
        {/* Honeypot — hidden from real users; bots fill it and get silently dropped. */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
          <label htmlFor={`lf-company-${variant}`}>Company</label>
          <input
            id={`lf-company-${variant}`}
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={form.company}
            onChange={(e) => update("company", e.target.value)}
          />
        </div>

        <div className={styles.head}>
          <h3 className={styles.title}>{title}</h3>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>

        <div className="field">
          <label className="field-label" htmlFor={`lf-name-${variant}`}>
            Name
          </label>
          <input
            id={`lf-name-${variant}`}
            className={`input ${errors.name ? "input--error" : ""}`}
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            autoComplete="name"
          />
          {errors.name && <p className="field-error">{errors.name}</p>}
        </div>

        <div className="field">
          <label className="field-label" htmlFor={`lf-contact-${variant}`}>
            Phone or Email
          </label>
          <input
            id={`lf-contact-${variant}`}
            className={`input ${errors.contact ? "input--error" : ""}`}
            value={form.contact}
            onChange={(e) => update("contact", e.target.value)}
          />
          {errors.contact && <p className="field-error">{errors.contact}</p>}
        </div>

        <div className="field">
          <label className="field-label" htmlFor={`lf-message-${variant}`}>
            How can we help?
          </label>
          <textarea
            id={`lf-message-${variant}`}
            className={`textarea ${styles.area} ${errors.message ? "textarea--error" : ""}`}
            value={form.message}
            onChange={(e) => update("message", e.target.value)}
            placeholder="Tell us about the job — repairs, remodel, plumbing, carpentry…"
          />
          {errors.message && <p className="field-error">{errors.message}</p>}
        </div>

        {status === "error" && <p className={styles.serverError}>{serverError}</p>}

        <button type="submit" className="btn btn--block" disabled={status === "submitting"}>
          {status === "submitting" ? "Sending…" : cta}
          {status !== "submitting" && <ArrowIcon />}
        </button>

        <p className={styles.fineprint}>No obligation. Free estimates · We reply fast.</p>
      </form>
    </div>
  );
}
