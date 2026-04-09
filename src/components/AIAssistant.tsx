

interface AIAssistantProps {
  message: string;
}

export function AIAssistant({ message }: AIAssistantProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-2 w-2 rounded-full bg-primary" />
        <span className="font-semibold text-sm text-foreground">AI learning assistant</span>
      </div>
      <div className="ml-4 border-l-2 border-primary/30 pl-4">
        <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
      </div>
      <div className="mt-4 flex gap-2 flex-wrap">
        {["Plan my week", "Find free courses", "Quick 20 min session"].map((action) => (
          <button
            key={action}
            className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  );
}
