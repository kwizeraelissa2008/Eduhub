import { StatCard } from "@/components/StatCard";
import { CourseCard } from "@/components/CourseCard";
import { AIAssistant } from "@/components/AIAssistant";
import { useDashboardData } from "@/hooks/useDashboardData";
import { CourseBadge } from "@/components/CourseBadge";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function Dashboard() {
  const { profile, streak, enrollments, isLoading } = useDashboardData();

  const displayName = profile?.display_name?.split(" ")[0] || "Learner";
  const inProgress = enrollments.filter((e) => e.status === "in_progress");
  const totalHours = Math.round(
    enrollments.reduce((sum, e) => sum + (e.time_spent_minutes || 0), 0) / 60
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">
            {getGreeting()}, {displayName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate()} — {inProgress.length} lessons suggested today
          </p>
        </div>
        <CourseBadge type="AI-adapted" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Streak" value={streak?.current_streak ?? 0} subtitle="days in a row" />
        <StatCard
          label="Enrolled"
          value={enrollments.length}
          subtitle={`${inProgress.length} in progress`}
        />
        <StatCard label="Hours learned" value={totalHours} subtitle="this month" />
      </div>

      {/* Continue Learning */}
      {inProgress.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-serif font-semibold text-foreground">Continue learning</h2>
          {inProgress.map((enrollment) => {
            const course = enrollment.courses as any;
            if (!course) return null;
            const remaining = Math.round(
              (course.estimated_hours * 60 - enrollment.time_spent_minutes) / 60 * 10
            ) / 10;
            return (
              <CourseCard
                courseId={course.id}
                key={enrollment.id}
                title={course.title}
                currentModule={enrollment.current_module}
                totalModules={course.total_modules}
                progressPercent={Number(enrollment.progress_percent)}
                badgeType={course.badge_type}
                timeLeft={
                  remaining > 1
                    ? `${remaining} hrs left`
                    : remaining > 0
                    ? `${Math.round(remaining * 60)} min left`
                    : "Almost done!"
                }
              />
            );
          })}
        </div>
      )}

      {inProgress.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <h2 className="text-lg font-serif font-semibold text-foreground">No courses yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Head to Explore to discover courses and start learning!
          </p>
        </div>
      )}

      {/* AI Assistant */}
      <AIAssistant
        message={
          inProgress.length > 0
            ? `Based on your pace and goals, I recommend continuing your ${inProgress[0]?.courses && (inProgress[0].courses as any).title} course today — it sets up next week's project.`
            : "Welcome to EduAccess! I recommend exploring our free courses to get started on your learning journey."
        }
      />
    </div>
  );
}
