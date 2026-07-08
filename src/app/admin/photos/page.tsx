import { isDbConfigured } from "@/lib/db";
import { listWorkPhotos, hasBlobStorage } from "@/lib/work-photos";
import AdminTopBar from "@/components/admin/AdminTopBar";
import GalleryManager from "@/components/admin/GalleryManager";

export const dynamic = "force-dynamic";

export default async function PhotosPage() {
  const photos = isDbConfigured ? await listWorkPhotos() : [];

  return (
    <>
      <AdminTopBar />
      <main className="adminMain">
        <div className="adminHead">
          <div>
            <h1 className="adminTitle">
              Work <span className="accent">Gallery</span>
            </h1>
            <p className="adminSub">
              Upload photos of Albert&rsquo;s work — they show up in the
              &ldquo;Our Work&rdquo; section on the website.
            </p>
          </div>
        </div>

        {!isDbConfigured ? (
          <div className="adminEmpty">
            <div>
              <p className="adminEmptyTitle">Database not connected</p>
              <p>
                Connect <code>DATABASE_URL</code> to manage the photo gallery.
              </p>
            </div>
          </div>
        ) : (
          <GalleryManager initialPhotos={photos} blobReady={hasBlobStorage} />
        )}
      </main>
    </>
  );
}
