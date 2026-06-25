import { isDbConfigured } from "@/lib/db";
import { listJobs } from "@/lib/jobs";
import AdminTopBar from "@/components/admin/AdminTopBar";
import JobBoard from "@/components/admin/JobBoard";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const { items: jobs, nextCursor } = await listJobs();

  return (
    <>
      <AdminTopBar />
      <main className="adminMain">
        <div className="adminHead">
          <div>
            <h1 className="adminTitle">
              Job <span className="accent">Board</span>
            </h1>
            <p className="adminSub">
              Work in motion — quoted through invoiced. Move a job by changing
              its stage.
            </p>
          </div>
        </div>

        {!isDbConfigured ? (
          <div className="adminEmpty">
            <div>
              <p className="adminEmptyTitle">Database not connected</p>
              <p>
                Jobs live in the database. Set <code>DATABASE_URL</code>, run{" "}
                <code>npm run db:migrate</code>, then create jobs from a
                customer record.
              </p>
            </div>
          </div>
        ) : (
          <JobBoard jobs={jobs} initialCursor={nextCursor} />
        )}
      </main>
    </>
  );
}
