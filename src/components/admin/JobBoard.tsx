"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AdminJob } from "@/lib/jobs";
import type { JobStatus } from "@/lib/db/schema";

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

export default function JobBoard({ jobs: initial }: { jobs: AdminJob[] }) {
  const [jobs, setJobs] = useState<AdminJob[]>(initial);

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
      <p className="jobCardTitle">{job.title}</p>
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
