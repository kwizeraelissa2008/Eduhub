import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CourseBadge } from "@/components/CourseBadge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function Explore() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("is_published", true)
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  const { data: enrolledIds = [], refetch: refetchEnrolled } = useQuery({
    queryKey: ["enrolled-ids", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("course_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data.map((e) => e.course_id);
    },
    enabled: !!user,
  });

  const handleEnroll = async (courseId: string) => {
    if (!user) return;
    setEnrollingId(courseId);
    try {
      const { error } = await supabase
        .from("enrollments")
        .insert({ user_id: user.id, course_id: courseId });
      if (error) throw error;
      toast({ title: "Enrolled!", description: "Course added to your learning list." });
      refetchEnrolled();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setEnrollingId(null);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading courses...</p></div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-serif text-foreground">Explore courses</h1>
        <p className="mt-1 text-sm text-muted-foreground">Discover new skills and start learning today</p>
      </div>

      <div className="grid gap-4">
        {courses.map((course) => {
          const enrolled = enrolledIds.includes(course.id);
          return (
            <div
              key={course.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-foreground">{course.title}</h3>
                  <CourseBadge type={course.badge_type} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{course.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {course.total_modules} modules · {course.estimated_hours} hrs
                </p>
              </div>
              <Button
                variant={enrolled ? "secondary" : "default"}
                size="sm"
                disabled={enrolled || enrollingId === course.id}
                onClick={() => handleEnroll(course.id)}
                className="ml-4 shrink-0"
              >
                {enrolled ? "Enrolled" : enrollingId === course.id ? "..." : "Enroll"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
