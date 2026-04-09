import { Download } from "lucide-react";

export default function OfflineLibrary() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-serif text-foreground">Offline Library</h1>
        <p className="mt-1 text-sm text-muted-foreground">Download materials for offline learning</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <Download className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <p className="mt-4 text-muted-foreground">No offline content downloaded yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Enroll in courses and download their materials for offline access.
        </p>
      </div>
    </div>
  );
}
