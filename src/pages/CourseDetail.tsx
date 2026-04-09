import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CourseBadge } from "@/components/CourseBadge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, Circle, Clock, BookOpen } from "lucide-react";

export default function CourseDetail() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: course } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").eq("id", courseId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  const { data: modules = [] } = useQuery({
    queryKey: ["course-modules", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_modules")
        .select("*")
        .eq("course_id", courseId!)
        .order("module_number");
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  const { data: enrollment } = useQuery({
    queryKey: ["enrollment", courseId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*")
        .eq("user_id", user!.id)
        .eq("course_id", courseId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!courseId,
  });

  const completeModule = useMutation({
    mutationFn: async (moduleNumber: number) => {
      if (!enrollment || !course) return;
      const newModule = Math.max(enrollment.current_module, moduleNumber + 1);
      const newProgress = Math.min(100, Math.round((moduleNumber / course.total_modules) * 100));
      const newTime = enrollment.time_spent_minutes + (modules.find(m => m.module_number === moduleNumber)?.estimated_minutes || 30);
      const newStatus = newProgress >= 100 ? "completed" : "in_progress";

      const { error } = await supabase
        .from("enrollments")
        .update({
          current_module: newModule,
          progress_percent: newProgress,
          time_spent_minutes: newTime,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", enrollment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["enrollment", courseId, user?.id] });
      qc.invalidateQueries({ queryKey: ["enrollments"] });
      toast({ title: "Module completed! 🎉" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (!course) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading course...</p></div>;
  }

  const currentModule = enrollment?.current_module || 1;
  const progress = enrollment?.progress_percent || 0;

  return (
    <div className="max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold font-serif text-foreground">{course.title}</h1>
          <CourseBadge type={course.badge_type} />
        </div>
        <p className="mt-2 text-muted-foreground">{course.description}</p>
        <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><BookOpen className="h-4 w-4" /> {course.total_modules} modules</span>
          <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {course.estimated_hours} hrs</span>
        </div>
      </div>

      {enrollment && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Progress</span>
            <span className="text-sm text-muted-foreground">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          {enrollment.status === "completed" && (
            <p className="mt-2 text-sm text-green-600 font-medium">✅ Course completed!</p>
          )}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-serif font-semibold text-foreground">Modules</h2>
        {modules.map((mod: any) => {
          const isCompleted = enrollment && mod.module_number < currentModule;
          const isCurrent = enrollment && mod.module_number === currentModule;
          const isLocked = enrollment && mod.module_number > currentModule;

          return (
            <div
              key={mod.id}
              className={`rounded-xl border p-4 transition-all ${
                isCurrent ? "border-primary bg-primary/5" : isCompleted ? "border-border bg-card" : "border-border bg-card opacity-60"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isCompleted ? (
                    <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                  ) : (
                    <Circle className={`h-5 w-5 shrink-0 ${isCurrent ? "text-primary" : "text-muted-foreground"}`} />
                  )}
                  <div>
                    <h3 className={`font-medium ${isCompleted ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {mod.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{mod.estimated_minutes} min</p>
                  </div>
                </div>
                {isCurrent && enrollment && enrollment.status !== "completed" && (
                  <Button
                    size="sm"
                    onClick={() => completeModule.mutate(mod.module_number)}
                    disabled={completeModule.isPending}
                  >
                    {completeModule.isPending ? "..." : "Complete"}
                  </Button>
                )}
              </div>
              {(isCurrent || isCompleted) && mod.content && (
                <p className="mt-3 text-sm text-muted-foreground pl-8">{mod.content}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
