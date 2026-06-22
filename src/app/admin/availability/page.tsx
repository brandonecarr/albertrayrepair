import { isDbConfigured } from "@/lib/db";
import { getWeeklyAvailability } from "@/lib/scheduling";
import AdminTopBar from "@/components/admin/AdminTopBar";
import AvailabilityEditor from "@/components/admin/AvailabilityEditor";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const days = await getWeeklyAvailability();

  return (
    <>
      <AdminTopBar />
      <main className="adminMain">
        <div className="adminHead">
          <div>
            <h1 className="adminTitle">
              Weekly <span className="accent">Availability</span>
            </h1>
            <p className="adminSub">
              The time slots customers can request, by day of the week.
            </p>
          </div>
        </div>

        {!isDbConfigured ? (
          <div className="adminEmpty">
            <div>
              <p className="adminEmptyTitle">Showing default hours</p>
              <p>
                These defaults are live on the booking form. Connect{" "}
                <code>DATABASE_URL</code> to customize days and times.
              </p>
            </div>
          </div>
        ) : (
          <AvailabilityEditor initial={days} />
        )}
      </main>
    </>
  );
}
