import Link from "next/link";
import AdminTopBar from "@/components/admin/AdminTopBar";

export default function AdminNotFound() {
  return (
    <>
      <AdminTopBar />
      <main className="adminMain">
        <div className="adminEmpty">
          <div>
            <p className="adminEmptyTitle">Not found</p>
            <p>
              That record doesn&rsquo;t exist or has been removed.{" "}
              <Link href="/admin" className="accent">
                Back to dashboard →
              </Link>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
