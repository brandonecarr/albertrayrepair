"use client";

import { useMemo, useRef, useState } from "react";
import { services, site } from "@/lib/site-config";
import { businessNowParts } from "@/lib/timezone";
import {
  ArrowIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  PhoneIcon,
} from "./Icons";
import AddressAutocomplete from "./AddressAutocomplete";
import styles from "./Booking.module.css";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAY_SLOTS = ["7:30 AM", "9:00 AM", "10:30 AM", "12:00 PM", "1:30 PM", "3:00 PM", "4:30 PM"];
const SATURDAY_SLOTS = ["8:00 AM", "9:30 AM", "11:00 AM", "12:30 PM"];

const MAX_DAYS_AHEAD = 60;

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
function longDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Progressive (xxx) xxx-xxxx formatting as the user types. */
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

type Status = "idle" | "submitting" | "success" | "error";

export default function Booking() {
  // "Today" must be the business's calendar date (Pacific), not the visitor's.
  // A customer in a timezone ahead of Pacific would otherwise lose same-day
  // booking. businessNowParts() uses the fixed business tz on both server and
  // client, so SSR and hydration agree.
  const today = useMemo(() => {
    const { year, month, day } = businessNowParts();
    return new Date(year, month - 1, day);
  }, []);
  const maxDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + MAX_DAYS_AHEAD);
    return d;
  }, [today]);

  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const [form, setForm] = useState({
    service: "",
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    company: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [serverError, setServerError] = useState("");

  // Slots are now driven by the live availability API (template − blocks −
  // already-booked). Falls back to the static defaults if the API is down.
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [dayClosed, setDayClosed] = useState(false);
  // Guards against out-of-order availability responses when the user clicks
  // through days quickly — only the most-recently requested date may apply.
  const slotReqRef = useRef(0);

  async function loadSlots(d: Date) {
    const reqId = ++slotReqRef.current;
    const iso = isoDate(d);
    setSlots([]);
    setDayClosed(false);
    setSlotsLoading(true);
    try {
      const res = await fetch(`/api/availability?date=${iso}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { closed?: boolean; slots?: string[] };
      if (reqId !== slotReqRef.current) return; // a newer day was selected
      setDayClosed(Boolean(data.closed));
      setSlots(Array.isArray(data.slots) ? data.slots : []);
    } catch {
      if (reqId !== slotReqRef.current) return;
      setSlots(d.getDay() === 6 ? SATURDAY_SLOTS : WEEKDAY_SLOTS);
    } finally {
      if (reqId === slotReqRef.current) setSlotsLoading(false);
    }
  }

  const days = useMemo(() => {
    const first = new Date(view.year, view.month, 1);
    const offset = first.getDay();
    const total = new Date(view.year, view.month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(new Date(view.year, view.month, d));
    return cells;
  }, [view]);

  const canPrev =
    view.year > today.getFullYear() ||
    (view.year === today.getFullYear() && view.month > today.getMonth());
  const canNext =
    view.year < maxDate.getFullYear() ||
    (view.year === maxDate.getFullYear() && view.month < maxDate.getMonth());

  function changeMonth(delta: number) {
    setView((v) => {
      const m = v.month + delta;
      const date = new Date(v.year, m, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  }

  function dayState(d: Date) {
    if (d.getDay() === 0) return "closed";
    if (d < today || d > maxDate) return "disabled";
    return "open";
  }

  function selectDay(d: Date) {
    setSelectedDate(d);
    setSelectedTime(null);
    void loadSlots(d);
  }

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: "" }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.service) e.service = "Choose a service";
    if (!selectedDate) e.date = "Pick a day";
    if (!selectedTime) e.time = "Pick a time";
    if (!form.name.trim()) e.name = "Your name is required";
    if (form.phone.replace(/\D/g, "").length !== 10)
      e.phone = "Enter a valid 10-digit phone number";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Enter a valid email";
    if (!form.address.trim()) e.address = "Service address is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) {
      document.getElementById("booking")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setStatus("submitting");
    setServerError("");
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: form.service,
          name: form.name,
          phone: form.phone,
          email: form.email,
          address: form.address,
          notes: form.notes,
          company: form.company,
          date: selectedDate ? isoDate(selectedDate) : "",
          dateLabel: selectedDate ? longDate(selectedDate) : "",
          time: selectedTime ?? "",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // Slot was taken between page-load and submit — refresh availability
        // and make the customer re-pick a time.
        if (res.status === 409 && data.slotTaken && selectedDate) {
          setSelectedTime(null);
          void loadSlots(selectedDate);
        }
        throw new Error(data.error || "Something went wrong. Please call us instead.");
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setServerError(err instanceof Error ? err.message : "Unexpected error");
    }
  }

  if (status === "success") {
    return (
      <section id="booking" className={`section section--ink grain ${styles.section}`}>
        <div className={`tex-grid--ink ${styles.gridLayer}`} aria-hidden />
        <div className={`container ${styles.successWrap}`}>
          <div className={styles.successCard}>
            <span className={styles.successIcon}>
              <CheckIcon />
            </span>
            <h2 className="h-lg">You&rsquo;re on the books!</h2>
            <p className={styles.successText}>
              Thanks, {form.name.split(" ")[0]}. Your request for{" "}
              <strong>{selectedDate ? longDate(selectedDate) : ""}</strong> at{" "}
              <strong>{selectedTime}</strong> has been sent to Albert. He&rsquo;ll confirm
              shortly by phone or text.
            </p>
            <p className={styles.successMeta}>
              Need it sooner? Call{" "}
              <a href={site.phoneHref} className={styles.successPhone}>
                {site.phoneDisplay}
              </a>
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="booking" className={`section section--ink grain ${styles.section}`}>
      <div className={`tex-grid--ink ${styles.gridLayer}`} aria-hidden />
      <div className="container">
        <div className={styles.head}>
          <p className="eyebrow eyebrow--center">Schedule A Visit</p>
          <h2 className="h-lg">
            Pick a time. <span className="accent">Consider it done.</span>
          </h2>
          <p className={styles.headSub}>
            Choose a day and slot that works for you. Albert confirms every booking
            personally&mdash;no call centers, no runaround.
          </p>
        </div>

        <form className={styles.layout} onSubmit={handleSubmit} noValidate>
          {/* Honeypot — hidden from real users; bots fill it and get silently dropped. */}
          <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
            <label htmlFor="company">Company</label>
            <input
              id="company"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={form.company}
              onChange={(e) => update("company", e.target.value)}
            />
          </div>

          {/* LEFT: calendar + time */}
          <div className={styles.scheduler}>
            <div className={styles.calHead}>
              <div className={styles.calTitle}>
                <CalendarIcon className={styles.calTitleIcon} />
                <span>
                  {MONTHS[view.month]} {view.year}
                </span>
              </div>
              <div className={styles.calNav}>
                <button
                  type="button"
                  className={styles.navBtn}
                  onClick={() => changeMonth(-1)}
                  disabled={!canPrev}
                  aria-label="Previous month"
                >
                  <ArrowIcon style={{ transform: "rotate(180deg)" }} />
                </button>
                <button
                  type="button"
                  className={styles.navBtn}
                  onClick={() => changeMonth(1)}
                  disabled={!canNext}
                  aria-label="Next month"
                >
                  <ArrowIcon />
                </button>
              </div>
            </div>

            <div className={styles.weekRow}>
              {WEEKDAYS.map((w) => (
                <span key={w} className={styles.weekDay}>
                  {w}
                </span>
              ))}
            </div>

            <div className={styles.calGrid}>
              {days.map((d, i) => {
                if (!d) return <span key={`x${i}`} className={styles.empty} />;
                const state = dayState(d);
                const isSel = selectedDate && isoDate(d) === isoDate(selectedDate);
                return (
                  <button
                    type="button"
                    key={isoDate(d)}
                    className={`${styles.day} ${isSel ? styles.daySel : ""} ${
                      state !== "open" ? styles.dayOff : ""
                    }`}
                    onClick={() => selectDay(d)}
                    disabled={state !== "open"}
                    aria-pressed={Boolean(isSel)}
                    aria-label={longDate(d)}
                    title={state === "closed" ? "Closed Sundays" : undefined}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
            {errors.date && <p className="field-error">{errors.date}</p>}

            <div className={styles.slots}>
              <div className={styles.slotsHead}>
                <ClockIcon className={styles.slotsIcon} />
                <span>
                  {selectedDate
                    ? `Available ${longDate(selectedDate)}`
                    : "Select a day to see times"}
                </span>
              </div>
              {selectedDate && slotsLoading && (
                <p className={styles.slotsNote}>Loading available times…</p>
              )}
              {selectedDate && !slotsLoading && dayClosed && (
                <p className={styles.slotsNote}>
                  Closed this day — please choose another.
                </p>
              )}
              {selectedDate && !slotsLoading && !dayClosed && slots.length === 0 && (
                <p className={styles.slotsNote}>
                  Fully booked this day. Try another, or call {site.phoneDisplay}.
                </p>
              )}
              {selectedDate && !slotsLoading && slots.length > 0 && (
                <div className={styles.slotGrid}>
                  {slots.map((t) => (
                    <button
                      type="button"
                      key={t}
                      className={`${styles.slot} ${
                        selectedTime === t ? styles.slotSel : ""
                      }`}
                      aria-pressed={selectedTime === t}
                      onClick={() => {
                        setSelectedTime(t);
                        if (errors.time) setErrors((e) => ({ ...e, time: "" }));
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
              {errors.time && <p className="field-error">{errors.time}</p>}
            </div>
          </div>

          {/* RIGHT: details */}
          <div className={styles.details}>
            <div className={styles.summary}>
              <span className={styles.summaryLabel}>Your Appointment</span>
              <span className={styles.summaryValue}>
                {selectedDate ? longDate(selectedDate) : "Choose a date"}
                {selectedTime ? ` · ${selectedTime}` : ""}
              </span>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="service">
                Service Needed
              </label>
              <select
                id="service"
                className={`select ${errors.service ? "input--error" : ""}`}
                value={form.service}
                onChange={(e) => update("service", e.target.value)}
              >
                <option value="">Select a service…</option>
                {services.map((s) => (
                  <option key={s.title} value={s.title}>
                    {s.title}
                  </option>
                ))}
                <option value="Other / Multiple">Other / Multiple</option>
              </select>
              {errors.service && <p className="field-error">{errors.service}</p>}
            </div>

            <div className={styles.twoCol}>
              <div className="field">
                <label className="field-label" htmlFor="name">
                  Full Name
                </label>
                <input
                  id="name"
                  className={`input ${errors.name ? "input--error" : ""}`}
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  autoComplete="name"
                />
                {errors.name && <p className="field-error">{errors.name}</p>}
              </div>
              <div className="field">
                <label className="field-label" htmlFor="phone">
                  Phone
                </label>
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  className={`input ${errors.phone ? "input--error" : ""}`}
                  value={form.phone}
                  onChange={(e) => update("phone", formatPhone(e.target.value))}
                  placeholder="(909) 471-0834"
                  autoComplete="tel"
                />
                {errors.phone && <p className="field-error">{errors.phone}</p>}
              </div>
            </div>

            <div className={styles.twoCol}>
              <div className="field">
                <label className="field-label" htmlFor="email">
                  Email <span className={styles.optional}>(optional)</span>
                </label>
                <input
                  id="email"
                  type="email"
                  className={`input ${errors.email ? "input--error" : ""}`}
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  autoComplete="email"
                />
                {errors.email && <p className="field-error">{errors.email}</p>}
              </div>
              <div className="field">
                <label className="field-label" htmlFor="address">
                  Service Address
                </label>
                <AddressAutocomplete
                  id="address"
                  value={form.address}
                  onChange={(v) => update("address", v)}
                  error={Boolean(errors.address)}
                  placeholder="Start typing your address…"
                />
                {errors.address && <p className="field-error">{errors.address}</p>}
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="notes">
                Tell Albert about the job <span className={styles.optional}>(optional)</span>
              </label>
              <textarea
                id="notes"
                className="textarea"
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="A leaky faucet, three rooms to paint, a fence gate that won't latch…"
              />
            </div>

            {status === "error" && (
              <p className={styles.serverError}>
                {serverError}{" "}
                <a href={site.phoneHref} className={styles.successPhone}>
                  {site.phoneDisplay}
                </a>
              </p>
            )}

            <button type="submit" className="btn btn--lg btn--block" disabled={status === "submitting"}>
              {status === "submitting" ? "Sending…" : "Request This Appointment"}
              {status !== "submitting" && <ArrowIcon />}
            </button>

            <p className={styles.fineprint}>
              <PhoneIcon className={styles.fineIcon} />
              Prefer to talk? Call {site.phoneDisplay}. Booking is a request&mdash;Albert
              confirms the final time with you.
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
