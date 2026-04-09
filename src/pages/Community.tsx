import { Users } from "lucide-react";

export default function Community() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-serif text-foreground">Community</h1>
        <p className="mt-1 text-sm text-muted-foreground">Connect with fellow learners</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <p className="mt-4 text-muted-foreground">Community features coming soon!</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Join discussions, share progress, and learn together.
        </p>
      </div>
    </div>
  );
}
