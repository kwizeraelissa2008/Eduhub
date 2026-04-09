import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CourseCard } from "@/components/CourseCard";

export default function MyCourses() {
  const { user } = useAuth();

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["my-courses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*, courses(*)")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-serif text-foreground">My courses</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {enrollments.length} course{enrollments.length !== 1 ? "s" : ""} enrolled
        </p>
      </div>

      {enrollments.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">You haven't enrolled in any courses yet.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {enrollments.map((enrollment) => {
            const course = enrollment.courses as any;
            if (!course) return null;
            const remaining = Math.round(
              (course.estimated_hours * 60 - enrollment.time_spent_minutes) / 60 * 10
            ) / 10;
            return (
              <CourseCard
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
    </div>
  );
}
