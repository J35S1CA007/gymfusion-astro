import { useState } from "react";
import PortalShell from "./PortalShell";

export default function FramePreview() {
  const [logoutMessage, setLogoutMessage] = useState("");

  return (
    <PortalShell
      active="dashboard"
      member={{ displayName: "Preview Member", initials: "PM" }}
      onLogout={() => setLogoutMessage("Mock Log Out invoked.")}
      title="Dashboard"
      description="Development preview only. No authenticated data is loaded."
    >
      <section className="flex min-h-[420px] items-center justify-center border border-black/15 bg-white p-8 text-center">
        <div>
          <p className="font-heading text-3xl font-bold">Members Portal frame</p>
          <p className="mt-3 text-black/65">Shell-only development preview.</p>
          <p className="mt-4 min-h-6 text-sm font-semibold" aria-live="polite" data-preview-logout-result>{logoutMessage}</p>
        </div>
      </section>
    </PortalShell>
  );
}
