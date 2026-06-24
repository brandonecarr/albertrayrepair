import Link from "next/link";
import { notFound } from "next/navigation";
import { isDbConfigured } from "@/lib/db";
import { getJobById, listJobNotes } from "@/lib/jobs";
import { listJobMaterials } from "@/lib/materials";
import AdminTopBar from "@/components/admin/AdminTopBar";
import JobDetail from "@/components/admin/JobDetail";

export const dynamic = "force-dynamic";

export default async function JobPage(ctx: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await ctx.params;

  if (!isDbConfigured) {
    return (
      <>
        <AdminTopBar />
        <main className="adminMain">
          <div className="adminEmpty">
            <div>
              <p className="adminEmptyTitle">Database not connected</p>
              <p>
                Connect <code>DATABASE_URL</code> to view job records.
              </p>
            </div>
          </div>
        </main>
      </>
    );
  }

  const job = await getJobById(id);
  if (!job) notFound();
  const [notes, materials] = await Promise.all([
    listJobNotes(id),
    listJobMaterials(id),
  ]);

  return (
    <>
      <AdminTopBar />
      <main className="adminMain">
        <Link href="/admin/jobs" className="adminBack">
          ← Job board
        </Link>
        <JobDetail job={job} initialNotes={notes} initialMaterials={materials} />
      </main>
    </>
  );
}
