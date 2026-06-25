"use client";

import { useEffect, useRef, useState } from "react";
import type * as L from "leaflet";

/**
 * Day route planner. Geocodes each stop (Photon), optimizes the visiting order
 * (OSRM /trip), and draws numbered pins + the driving route on a Leaflet /
 * OpenStreetMap map. All three are free and need no API key. Albert can
 * re-optimize, sort by appointment time, or reorder stops by hand.
 */

export type RouteStop = {
  id: string;
  name: string;
  time: string;
  address: string;
  service: string | null;
};

type Geo = { lat: number; lon: number };
type Located = { stop: RouteStop; geo: Geo };

const BASE: [number, number] = [34.5008, -117.1858]; // Apple Valley

// ── Free, key-less services ───────────────────────────────────────────────

async function geocode(address: string, signal?: AbortSignal): Promise<Geo | null> {
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
      address
    )}&limit=1&lat=${BASE[0]}&lon=${BASE[1]}`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: { geometry?: { coordinates?: number[] } }[];
    };
    const c = data.features?.[0]?.geometry?.coordinates;
    if (Array.isArray(c) && c.length === 2) return { lon: c[0], lat: c[1] };
    return null;
  } catch {
    return null;
  }
}

/** OSRM trip solves the TSP — returns the optimized order of input indices. */
async function optimizeOrder(geos: Geo[], signal?: AbortSignal): Promise<number[] | null> {
  if (geos.length < 2) return geos.map((_, i) => i);
  try {
    const path = geos.map((g) => `${g.lon},${g.lat}`).join(";");
    const url = `https://router.project-osrm.org/trip/v1/driving/${path}?source=first&roundtrip=true&overview=false`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      code?: string;
      waypoints?: { waypoint_index: number }[];
    };
    if (data.code !== "Ok" || !data.waypoints) return null;
    return data.waypoints
      .map((w, i) => ({ i, wi: w.waypoint_index }))
      .sort((a, b) => a.wi - b.wi)
      .map((x) => x.i);
  } catch {
    return null;
  }
}

/** OSRM route — road geometry + distance/duration for a given order. */
async function routeFor(
  geos: Geo[],
  signal?: AbortSignal
): Promise<{ line: [number, number][]; meters: number; seconds: number } | null> {
  if (geos.length < 2) return null;
  try {
    const path = geos.map((g) => `${g.lon},${g.lat}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      routes?: {
        geometry: { coordinates: [number, number][] };
        distance: number;
        duration: number;
      }[];
    };
    const r = data.routes?.[0];
    if (!r) return null;
    const line = r.geometry.coordinates.map(
      ([lon, lat]) => [lat, lon] as [number, number]
    );
    return { line, meters: r.distance, seconds: r.duration };
  } catch {
    return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Escape text before injecting it into a Leaflet popup's raw HTML. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Rotate an order array so `value` comes first (keeps the optimized sequence). */
function rotateToStart(order: number[], value: number): number[] {
  const p = order.indexOf(value);
  return p <= 0 ? order : [...order.slice(p), ...order.slice(0, p)];
}

function miles(m: number): string {
  return `${(m / 1609.34).toFixed(1)} mi`;
}
function drive(sec: number): string {
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

/** Google Maps directions URL (free, no key) for turn-by-turn navigation. */
function mapsUrl(stops: RouteStop[]): string {
  const pts = stops.map((s) => encodeURIComponent(s.address)).join("/");
  return `https://www.google.com/maps/dir/${pts}`;
}

// ── Component ─────────────────────────────────────────────────────────────

type Status = "loading" | "empty" | "ready" | "error";

export default function RouteManager({
  dayLabel,
  stops,
}: {
  dayLabel: string;
  stops: RouteStop[];
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [located, setLocated] = useState<Located[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [summary, setSummary] = useState<{ meters: number; seconds: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [unmappable, setUnmappable] = useState<string[]>([]);
  const [routeWarning, setRouteWarning] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const Lref = useRef<typeof import("leaflet") | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);

  function redraw(
    locatedArr: Located[],
    ord: number[],
    line: [number, number][] | null
  ) {
    const Lm = Lref.current;
    const map = mapRef.current;
    if (!Lm || !map) return;
    markersRef.current?.remove();
    lineRef.current?.remove();

    const group = Lm.layerGroup().addTo(map);
    ord.forEach((idx, pos) => {
      const { stop, geo } = locatedArr[idx];
      const icon = Lm.divIcon({
        className: "routePin",
        html: `<span>${pos + 1}</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      Lm.marker([geo.lat, geo.lon], { icon })
        .addTo(group)
        .bindPopup(
          `<strong>${pos + 1}. ${esc(stop.name)}</strong><br/>${esc(stop.time)} · ${esc(stop.address)}`
        );
    });
    markersRef.current = group;

    if (line && line.length > 1) {
      const pl = Lm.polyline(line, { color: "#f26a1f", weight: 4, opacity: 0.85 }).addTo(map);
      lineRef.current = pl;
      map.fitBounds(pl.getBounds(), { padding: [42, 42] });
    } else {
      const pts = ord.map((i) => [locatedArr[i].geo.lat, locatedArr[i].geo.lon] as [number, number]);
      if (pts.length) map.fitBounds(pts, { padding: [42, 42], maxZoom: 14 });
    }
  }

  // Build everything on mount (parent remounts via key={day}).
  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    (async () => {
      setStatus("loading");
      setRouteWarning(false);
      const Lmod = await import("leaflet");
      if (cancelled) return;
      Lref.current = Lmod;

      const results = await Promise.all(
        stops.map(async (stop) => ({ stop, geo: await geocode(stop.address, ac.signal) }))
      );
      if (cancelled) return;
      const ok = results.filter((r): r is Located => r.geo !== null);
      const bad = results.filter((r) => r.geo === null).map((r) => r.stop.name);
      setLocated(ok);
      setUnmappable(bad);

      if (ok.length === 0) {
        setStatus("empty");
        return;
      }

      if (!mapRef.current && containerRef.current) {
        const map = Lmod.map(containerRef.current, { scrollWheelZoom: false }).setView(
          [ok[0].geo.lat, ok[0].geo.lon],
          12
        );
        Lmod.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(map);
        mapRef.current = map;
      }

      let ord = ok.map((_, i) => i);
      let line: [number, number][] | null = null;
      let summ: { meters: number; seconds: number } | null = null;
      if (ok.length >= 2) {
        const opt = await optimizeOrder(ok.map((m) => m.geo), ac.signal);
        if (opt) ord = rotateToStart(opt, 0);
        const rt = await routeFor(ord.map((i) => ok[i].geo), ac.signal);
        if (rt) {
          line = rt.line;
          summ = { meters: rt.meters, seconds: rt.seconds };
        } else if (!cancelled) {
          // Geocoding worked but the router is unreachable — show pins without
          // a drawn route and tell Albert rather than silently dropping it.
          setRouteWarning(true);
        }
      }
      if (cancelled) return;
      setOrder(ord);
      setSummary(summ);
      setStatus("ready");
      // let the map container size settle, then draw
      setTimeout(() => {
        mapRef.current?.invalidateSize();
        redraw(ok, ord, line);
      }, 0);
    })();
    return () => {
      cancelled = true;
      ac.abort();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function recompute(ord: number[]) {
    const rt = located.length >= 2 ? await routeFor(ord.map((i) => located[i].geo)) : null;
    setSummary(rt ? { meters: rt.meters, seconds: rt.seconds } : null);
    redraw(located, ord, rt?.line ?? null);
  }

  async function move(pos: number, dir: -1 | 1) {
    const ni = pos + dir;
    if (ni < 0 || ni >= order.length) return;
    const next = [...order];
    [next[pos], next[ni]] = [next[ni], next[pos]];
    setOrder(next);
    setBusy(true);
    await recompute(next);
    setBusy(false);
  }

  async function optimize() {
    setBusy(true);
    const opt = await optimizeOrder(located.map((m) => m.geo));
    const ord = opt ? rotateToStart(opt, 0) : order;
    setOrder(ord);
    await recompute(ord);
    setBusy(false);
  }

  async function sortByTime() {
    const ord = located.map((_, i) => i); // located is already in time order
    setOrder(ord);
    setBusy(true);
    await recompute(ord);
    setBusy(false);
  }

  if (stops.length === 0) {
    return (
      <div className="routeWrap">
        <p className="routeEmpty">No appointments with an address on {dayLabel}.</p>
      </div>
    );
  }

  const ordered = order.map((i) => located[i]).filter(Boolean);

  return (
    <div className="routeWrap">
      <div className="routeHead">
        <div>
          <h3 className="routeTitle">Route for {dayLabel}</h3>
          <p className="routeSub">
            {status === "loading"
              ? "Mapping stops…"
              : summary
                ? `${ordered.length} stops · ${miles(summary.meters)} · ~${drive(summary.seconds)} driving`
                : `${ordered.length} stop${ordered.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="routeActions">
          <button className="adminTab" onClick={optimize} disabled={busy || located.length < 2}>
            Optimize
          </button>
          <button className="adminTab" onClick={sortByTime} disabled={busy || located.length < 2}>
            By time
          </button>
          {located.length > 0 && (
            <a
              className="adminTab"
              href={mapsUrl(ordered.map((o) => o.stop))}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in Maps →
            </a>
          )}
        </div>
      </div>

      <div className="routeBody">
        <ol className="routeList">
          {ordered.map((o, pos) => (
            <li key={o.stop.id} className="routeStop">
              <span className="routeStopNum">{pos + 1}</span>
              <div className="routeStopBody">
                <span className="routeStopName">{o.stop.name}</span>
                <span className="routeStopMeta">
                  {o.stop.time}
                  {o.stop.service ? ` · ${o.stop.service}` : ""}
                </span>
                <span className="routeStopAddr">{o.stop.address}</span>
              </div>
              <div className="routeStopMove">
                <button
                  className="routeMoveBtn"
                  onClick={() => move(pos, -1)}
                  disabled={busy || pos === 0}
                  aria-label="Move earlier"
                >
                  ↑
                </button>
                <button
                  className="routeMoveBtn"
                  onClick={() => move(pos, 1)}
                  disabled={busy || pos === ordered.length - 1}
                  aria-label="Move later"
                >
                  ↓
                </button>
              </div>
            </li>
          ))}
          {unmappable.length > 0 && (
            <li className="routeUnmappable">
              Couldn&rsquo;t map: {unmappable.join(", ")} (check the address)
            </li>
          )}
          {routeWarning && (
            <li className="routeUnmappable">
              Routing is unavailable right now — showing stops without a drawn
              route. The optimized order may be approximate.
            </li>
          )}
        </ol>

        <div className="routeMapWrap">
          <div ref={containerRef} className="routeMap" />
          {status === "loading" && <div className="routeMapLoading">Loading map…</div>}
        </div>
      </div>
    </div>
  );
}
