import { Download, BookOpen, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { CourseBadge } from "@/components/CourseBadge";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function OfflineLibrary() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState<string | null>(null);

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["offline-courses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*, courses(*)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const handleDownload = async (courseId: string, courseTitle: string) => {
    setDownloading(courseId);
    // Fetch module content for this course
    const { data: modules } = await supabase
      .from("course_modules")
      .select("*")
      .eq("course_id", courseId)
      .order("module_number");

    if (modules && modules.length > 0) {
      // Create downloadable text content
      const content = modules.map((m: any) =>
        `## ${m.title}\n\n${m.content || "Content not yet available."}\n\nEstimated time: ${m.estimated_minutes} minutes\n`
      ).join("\n---\n\n");

      const blob = new Blob([`# ${courseTitle}\n\n${content}`], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${courseTitle.replace(/\s+/g, "_")}.md`;
      a.click();
      URL.revokeObjectURL(url);

      setDownloaded((prev) => new Set(prev).add(courseId));
      toast({ title: "Downloaded!", description: `${courseTitle} saved for offline reading.` });
    } else {
      toast({ title: "No content", description: "This course has no downloadable content yet.", variant: "destructive" });
    }
    setDownloading(null);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-serif text-foreground">Offline Library</h1>
        <p className="mt-1 text-sm text-muted-foreground">Download course materials for offline learning</p>
      </div>

      {enrollments.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Download className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">No courses to download yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">Enroll in courses first, then download their materials here.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {enrollments.map((enrollment: any) => {
            const course = enrollment.courses;
            if (!course) return null;
            const isDownloaded = downloaded.has(course.id);
            return (
              <div key={enrollment.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-3 flex-1">
                  <BookOpen className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{course.title}</h3>
                      <CourseBadge type={course.badge_type} />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {course.total_modules} modules · {course.estimated_hours} hrs
                    </p>
                  </div>
                </div>
                <Button
                  variant={isDownloaded ? "secondary" : "default"}
                  size="sm"
                  onClick={() => handleDownload(course.id, course.title)}
                  disabled={downloading === course.id}
                  className="ml-4 shrink-0"
                >
                  {isDownloaded ? (
                    <><Check className="h-4 w-4 mr-1" /> Downloaded</>
                  ) : downloading === course.id ? (
                    "Downloading..."
                  ) : (
                    <><Download className="h-4 w-4 mr-1" /> Download</>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
