import { cn } from "@/lib/utils";

const badgeStyles: Record<string, string> = {
  Free: "border-badge-free text-badge-free",
  "AI-adapted": "border-badge-ai text-badge-ai",
  Scholarship: "border-badge-scholarship text-badge-scholarship",
};

export function CourseBadge({ type }: { type: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-medium",
        badgeStyles[type] || "border-border text-muted-foreground"
      )}
    >
      {type}
    </span>
  );
}
