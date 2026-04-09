import { useNavigate } from "react-router-dom";
import { Bot } from "lucide-react";

interface AIAssistantProps {
  message: string;
}

const quickActions = [
  { label: "Plan my week", prompt: "Help me plan my study schedule for this week based on my enrolled courses." },
  { label: "Find free courses", prompt: "What free courses do you recommend for a beginner in tech?" },
  { label: "Quick 20 min session", prompt: "Suggest a productive 20-minute study session I can do right now." },
];

export function AIAssistant({ message }: AIAssistantProps) {
  const navigate = useNavigate();

  const handleAction = (prompt: string) => {
    navigate("/ai-tutor", { state: { initialPrompt: prompt } });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Bot className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm text-foreground">AI learning assistant</span>
      </div>
      <div className="ml-4 border-l-2 border-primary/30 pl-4">
        <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
      </div>
      <div className="mt-4 flex gap-2 flex-wrap">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => handleAction(action.prompt)}
            className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
