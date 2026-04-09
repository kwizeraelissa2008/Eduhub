import { CourseBadge } from "./CourseBadge";
import { useNavigate } from "react-router-dom";

interface CourseCardProps {
  title: string;
  currentModule: number;
  totalModules: number;
  progressPercent: number;
  badgeType: string;
  timeLeft?: string;
  courseId?: string;
}

const progressColors: Record<string, string> = {
  Free: "bg-primary",
  "AI-adapted": "bg-success",
  Scholarship: "bg-warning",
};

export function CourseCard({
  title,
  currentModule,
  totalModules,
  progressPercent,
  badgeType,
  timeLeft,
  courseId,
}: CourseCardProps) {
  const navigate = useNavigate();
  const progressColor = progressColors[badgeType] || "bg-primary";

  return (
    <div
      className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md cursor-pointer"
      onClick={() => courseId && navigate(`/course/${courseId}`)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Module {currentModule} of {totalModules}
            {timeLeft && <span className="ml-3">{timeLeft}</span>}
          </p>
        </div>
        <CourseBadge type={badgeType} />
      </div>
      <div className="mt-4 h-1.5 w-full rounded-full bg-secondary">
        <div
          className={`h-full rounded-full ${progressColor} transition-all duration-500`}
          style={{ width: `${Math.min(progressPercent, 100)}%` }}
        />
      </div>
    </div>
  );
}
