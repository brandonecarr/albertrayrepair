"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminWorkPhoto } from "@/lib/work-photos";

export default function GalleryManager({
  initialPhotos,
  blobReady,
}: {
  initialPhotos: AdminWorkPhoto[];
  blobReady: boolean;
}) {
  const router = useRouter();
  const [photos, setPhotos] = useState<AdminWorkPhoto[]>(initialPhotos);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (caption.trim()) form.append("caption", caption.trim());
      const res = await fetch("/api/admin/work-photos", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Upload failed.");
        return;
      }
      setPhotos((p) => [...p, data.photo]);
      setCaption("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void upload(file);
  }

  async function remove(id: string) {
    if (!confirm("Remove this photo from the gallery?")) return;
    const prev = photos;
    setPhotos((p) => p.filter((x) => x.id !== id));
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/work-photos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setPhotos(prev); // rollback
      setError("Couldn't remove that photo.");
    } finally {
      setBusyId(null);
    }
  }

  async function saveCaption(id: string, value: string) {
    const next = value.trim() || null;
    setPhotos((p) => p.map((x) => (x.id === id ? { ...x, caption: next } : x)));
    try {
      await fetch(`/api/admin/work-photos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: next }),
      });
    } catch {
      /* best-effort; refresh will reconcile */
    }
  }

  async function persistOrder(list: AdminWorkPhoto[]) {
    try {
      await fetch("/api/admin/work-photos/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: list.map((p) => p.id) }),
      });
    } catch {
      /* best-effort */
    }
  }

  function move(index: number, dir: -1 | 1) {
    const ni = index + dir;
    if (ni < 0 || ni >= photos.length) return;
    const next = [...photos];
    [next[index], next[ni]] = [next[ni], next[index]];
    setPhotos(next);
    void persistOrder(next);
  }

  return (
    <div className="galMgr">
      {!blobReady && (
        <p className="adminNotice" style={{ marginTop: 0 }}>
          Photo uploads aren&rsquo;t enabled yet. Create a{" "}
          <strong>Vercel Blob</strong> store and set{" "}
          <code>BLOB_READ_WRITE_TOKEN</code>, then redeploy. You can still edit,
          reorder, and remove existing photos.
        </p>
      )}

      <div className="galUpload">
        <input
          type="text"
          className="adminInput"
          placeholder="Optional caption (e.g. Master bath tile & grout)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          disabled={!blobReady || uploading}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={onPick}
          disabled={!blobReady || uploading}
          hidden
        />
        <button
          type="button"
          className="adminLoginBtn"
          style={{ marginTop: 0, width: "auto", padding: "12px 26px" }}
          onClick={() => fileRef.current?.click()}
          disabled={!blobReady || uploading}
        >
          {uploading ? "Uploading…" : "+ Upload photo"}
        </button>
      </div>
      {error && (
        <p className="field-error" role="alert" style={{ marginTop: 4 }}>
          {error}
        </p>
      )}

      {photos.length === 0 ? (
        <div className="adminEmpty" style={{ marginTop: 20 }}>
          <div>
            <p className="adminEmptyTitle">No photos yet</p>
            <p>Upload Albert&rsquo;s work photos above to build the gallery.</p>
          </div>
        </div>
      ) : (
        <div className="galGrid">
          {photos.map((p, i) => (
            <div key={p.id} className="galCard">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption || "Work photo"} className="galThumb" />
              <div className="galCardBody">
                <input
                  type="text"
                  className="adminInput galCaption"
                  defaultValue={p.caption ?? ""}
                  placeholder="Add a caption…"
                  onBlur={(e) => saveCaption(p.id, e.target.value)}
                  aria-label="Photo caption"
                />
                <div className="galActions">
                  <button
                    type="button"
                    className="galMove"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="Move earlier"
                    title="Move earlier"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="galMove"
                    onClick={() => move(i, 1)}
                    disabled={i === photos.length - 1}
                    aria-label="Move later"
                    title="Move later"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="galDelete"
                    onClick={() => remove(p.id)}
                    disabled={busyId === p.id}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
