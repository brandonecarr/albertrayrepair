"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./AddressAutocomplete.module.css";

/**
 * Service-address field with type-ahead autocomplete powered by Photon
 * (photon.komoot.io) — a free, key-less geocoder built on OpenStreetMap.
 * No account, no billing: it works out of the box. Suggestions are biased
 * toward the High Desert service area, and the field stays free-typeable as
 * a fallback. The chosen (or typed) value is stored as one address string.
 */

// Bias suggestions toward Apple Valley / the High Desert.
const BIAS_LAT = 34.5008;
const BIAS_LON = -117.1858;

type PhotonProps = {
  name?: string;
  housenumber?: string;
  street?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  postcode?: string;
  countrycode?: string;
};
type PhotonFeature = { properties?: PhotonProps };

function formatAddress(p: PhotonProps): string {
  const line1 = [p.housenumber, p.street].filter(Boolean).join(" ") || p.name || "";
  const city = p.city || p.town || p.village || p.county || "";
  const region = [p.state, p.postcode].filter(Boolean).join(" ");
  return [line1, city, region].filter(Boolean).join(", ");
}

export default function AddressAutocomplete({
  id,
  value,
  onChange,
  error,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const skipFetch = useRef(false);
  const debounceRef = useRef<number | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced lookup whenever the typed value changes.
  useEffect(() => {
    if (skipFetch.current) {
      skipFetch.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 4) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
          q
        )}&limit=5&lang=en&lat=${BIAS_LAT}&lon=${BIAS_LON}`;
        const res = await fetch(url, { signal: ac.signal });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { features?: PhotonFeature[] };
        const list = (data.features ?? [])
          .map((f) => f.properties ?? {})
          .filter((p) => (p.countrycode ?? "US") === "US")
          .map(formatAddress)
          .filter(Boolean);
        const uniq = [...new Set(list)];
        setSuggestions(uniq);
        setOpen(uniq.length > 0);
        setActive(-1);
      } catch {
        /* network/abort — leave the field as a plain input */
      }
    }, 250);
    return () => window.clearTimeout(debounceRef.current);
  }, [value]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function choose(s: string) {
    skipFetch.current = true; // don't re-search the value we just set
    onChange(s);
    setSuggestions([]);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      // Don't submit the form while choosing an address.
      e.preventDefault();
      if (active >= 0) choose(suggestions[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <input
        id={id}
        className={`input ${error ? "input--error" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={`${id}-listbox`}
        aria-activedescendant={open && active >= 0 ? `${id}-opt-${active}` : undefined}
      />
      {open && (
        <ul className={styles.list} role="listbox" id={`${id}-listbox`}>
          {suggestions.map((s, i) => (
            <li
              key={s}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={`${styles.item} ${i === active ? styles.itemActive : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(s);
              }}
              onMouseEnter={() => setActive(i)}
            >
              {s}
            </li>
          ))}
          <li className={styles.attr} aria-hidden="true">
            Addresses by OpenStreetMap
          </li>
        </ul>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {open && suggestions.length > 0
          ? `${suggestions.length} address suggestion${suggestions.length === 1 ? "" : "s"} available`
          : ""}
      </span>
    </div>
  );
}
