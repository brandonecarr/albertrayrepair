import { Suspense } from "react";
import { isAuthConfigured } from "@/lib/auth";
import LoginForm from "@/components/admin/LoginForm";

export default function AdminLoginPage() {
  return (
    <div className="adminLogin">
      <div className="adminLoginCard">
        <div className="adminLoginBrand">
          <span className="adminBrandMark">AR</span>
          <span className="adminLoginTitle">Ops Console</span>
        </div>

        {isAuthConfigured ? (
          <>
            <p className="adminLoginSub">Albert Ray&rsquo;s Repairs &amp; Restoration — staff only.</p>
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </>
        ) : (
          <>
            <p className="adminLoginSub">Admin sign-in isn&rsquo;t configured yet.</p>
            <p className="adminNotice">
              To enable the ops console, set <code>ADMIN_PASSWORD</code> and{" "}
              <code>AUTH_SECRET</code> in your environment, then redeploy.
              Generate a secret with <code>openssl rand -base64 32</code>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
