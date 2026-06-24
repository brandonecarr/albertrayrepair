"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./MaterialAutocomplete.module.css";

/**
 * Material-name input with reuse: as you type, it suggests previously-entered
 * materials (and their last price) from /api/admin/materials. Picking one fills
 * the name and price. Free-typing a new name creates a new reusable tag.
 */
type Suggestion = { name: string; priceCents: number };

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

export default function MaterialAutocomplete({
  value,
  onChangeName,
  onPick,
  placeholder,
}: {
  value: string;
  onChangeName: (name: string) => void;
  onPick: (s: Suggestion) => void;
  placeholder?: string;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const skip = useRef(false);
  const debounce = useRef<number | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    const q = value.trim();
    if (!q) {
      setItems([]);
      setOpen(false);
      return;
    }
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch(`/api/admin/materials?q=${encodeURIComponent(q)}`, {
          signal: ac.signal,
        });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { suggestions?: Suggestion[] };
        const list = data.suggestions ?? [];
        setItems(list);
        setOpen(list.length > 0);
        setActive(-1);
      } catch {
        /* ignore */
      }
    }, 200);
    return () => window.clearTimeout(debounce.current);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function choose(s: Suggestion) {
    skip.current = true;
    onPick(s);
    setItems([]);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (active >= 0) {
        e.preventDefault();
        choose(items[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <input
        className="adminInput"
        value={value}
        onChange={(e) => onChangeName(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => items.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && (
        <ul className={styles.list} role="listbox">
          {items.map((s, i) => (
            <li
              key={s.name}
              role="option"
              aria-selected={i === active}
              className={`${styles.item} ${i === active ? styles.itemActive : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(s);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span>{s.name}</span>
              <span className={styles.price}>{money(s.priceCents)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
