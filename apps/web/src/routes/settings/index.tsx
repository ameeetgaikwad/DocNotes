import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";

export const Route = createFileRoute("/settings/")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and practice settings
        </p>
      </div>

      <div className="grid gap-6">
        <div className="rounded-xl border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Profile</h2>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Settings className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="font-medium">Doctor Name</p>
              <p className="text-sm text-muted-foreground">
                doctor@docnotes.app
              </p>
              <p className="text-sm text-muted-foreground">
                General Practitioner
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Practice</h2>
          <p className="text-muted-foreground">
            Practice settings will be configurable here
          </p>
        </div>
      </div>
    </div>
  );
}
