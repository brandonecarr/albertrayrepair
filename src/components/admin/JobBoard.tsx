"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminJob } from "@/lib/jobs";
import type { JobStatus } from "@/lib/db/schema";
import type { Cursor } from "@/lib/pagination";

const PIPELINE: JobStatus[] = [
  "quoted",
  "scheduled",
  "in_progress",
  "completed",
  "invoiced",
];
const ALL_STATUSES: JobStatus[] = [...PIPELINE, "cancelled"];
const LABELS: Record<JobStatus, string> = {
  quoted: "Quoted",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  invoiced: "Invoiced",
  cancelled: "Cancelled",
};

function money(cents: number | null): string {
  if (cents === null) return "";
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

export default function JobBoard({
  jobs: initial,
  initialCursor = null,
}: {
  jobs: AdminJob[];
  initialCursor?: Cursor | null;
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState<AdminJob[]>(initial);
  const [cursor, setCursor] = useState<Cursor | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ beforeAt: cursor.createdAt, beforeId: cursor.id });
      const res = await fetch(`/api/admin/jobs/list?${params}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.items)) {
        setJobs((prev) => [...prev, ...data.items]);
        setCursor(data.nextCursor ?? null);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  const byStatus = useMemo(() => {
    const m: Record<JobStatus, AdminJob[]> = {
      quoted: [],
      scheduled: [],
      in_progress: [],
      completed: [],
      invoiced: [],
      cancelled: [],
    };
    for (const j of jobs) m[j.status].push(j);
    return m;
  }, [jobs]);

  // Money still in motion: quoted, scheduled, or in progress — not yet
  // completed/invoiced (closed) or cancelled.
  const OPEN: JobStatus[] = ["quoted", "scheduled", "in_progress"];
  const pipelineTotal = useMemo(
    () =>
      jobs
        .filter((j) => OPEN.includes(j.status))
        .reduce((sum, j) => sum + (j.amountCents ?? 0), 0),
    [jobs]
  );

  async function move(jobId: string, status: JobStatus) {
    const prev = jobs;
    setJobs((js) => js.map((j) => (j.id === jobId ? { ...j, status } : j)));
    try {
      const res = await fetch(`/api/admin/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      // Completing/invoicing a job changes server-computed figures elsewhere
      // (customer lifetime spend, completed-job counts). Re-sync them.
      router.refresh();
    } catch {
      setJobs(prev);
    }
  }

  if (jobs.length === 0) {
    return (
      <div className="adminEmpty">
        <div>
          <p className="adminEmptyTitle">No jobs yet</p>
          <p>
            Open a customer from the roster and hit <strong>+ New job</strong> to
            start tracking work here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {pipelineTotal > 0 && (
        <p className="jobPipeTotal">
          Open pipeline value:{" "}
          <strong>{money(pipelineTotal)}</strong>
        </p>
      )}

      <div className="jobBoard">
        {PIPELINE.map((status) => (
          <div key={status} className="jobCol">
            <div className={`jobColHead jch-${status}`}>
              <span>{LABELS[status]}</span>
              <span className="jobColCount">{byStatus[status].length}</span>
            </div>
            <div className="jobColBody">
              {byStatus[status].length === 0 ? (
                <p className="jobColEmpty">—</p>
              ) : (
                byStatus[status].map((j) => (
                  <JobCard key={j.id} job={j} onMove={move} />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {byStatus.cancelled.length > 0 && (
        <div className="jobCancelled">
          <p className="jobCancelledHead">Cancelled ({byStatus.cancelled.length})</p>
          <div className="jobCancelledRows">
            {byStatus.cancelled.map((j) => (
              <JobCard key={j.id} job={j} onMove={move} />
            ))}
          </div>
        </div>
      )}

      {cursor && (
        <button className="loadMoreBtn" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? "Loading…" : "Load older jobs"}
        </button>
      )}
    </>
  );
}

function JobCard({
  job,
  onMove,
}: {
  job: AdminJob;
  onMove: (id: string, status: JobStatus) => void;
}) {
  return (
    <div className={`jobCard jc-${job.status}`}>
      <Link href={`/admin/jobs/${job.id}`} className="jobCardTitle">
        {job.title}
      </Link>
      {job.customerName && (
        <Link href={`/admin/customers/${job.customerId}`} className="jobCardCust">
          {job.customerName}
        </Link>
      )}
      <p className="jobCardMeta">
        {money(job.amountCents)}
        {job.amountCents !== null && (job.scheduledDate || job.scheduledTime) ? " · " : ""}
        {job.scheduledDate}
        {job.scheduledTime ? ` ${job.scheduledTime}` : ""}
      </p>
      <select
        className="jobCardSelect"
        value={job.status}
        onChange={(e) => onMove(job.id, e.target.value as JobStatus)}
        aria-label="Move job to stage"
      >
        {ALL_STATUSES.map((s) => (
          <option key={s} value={s}>
            {LABELS[s]}
          </option>
        ))}
      </select>
    </div>
  );
}
