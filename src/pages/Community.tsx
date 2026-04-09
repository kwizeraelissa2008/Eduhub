import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Users, MessageSquare, Plus, Send, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Community() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["discussion-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discussion_posts")
        .select("*, profiles:user_id(display_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: replies = [] } = useQuery({
    queryKey: ["discussion-replies", selectedPost],
    queryFn: async () => {
      if (!selectedPost) return [];
      const { data, error } = await supabase
        .from("discussion_replies")
        .select("*, profiles:user_id(display_name)")
        .eq("post_id", selectedPost)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedPost,
  });

  const createPost = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("discussion_posts").insert({
        user_id: user!.id,
        title: title.trim(),
        content: content.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discussion-posts"] });
      setTitle(""); setContent(""); setShowForm(false);
      toast({ title: "Post created!" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createReply = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("discussion_replies").insert({
        post_id: selectedPost!,
        user_id: user!.id,
        content: replyContent.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discussion-replies", selectedPost] });
      setReplyContent("");
      toast({ title: "Reply posted!" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deletePost = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from("discussion_posts").delete().eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discussion-posts"] });
      if (selectedPost) setSelectedPost(null);
      toast({ title: "Post deleted" });
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">Community</h1>
          <p className="mt-1 text-sm text-muted-foreground">Connect with fellow learners</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> New Post
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <Input placeholder="Post title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="What's on your mind?" value={content} onChange={(e) => setContent(e.target.value)} rows={3} />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" onClick={() => createPost.mutate()} disabled={!title.trim() || !content.trim() || createPost.isPending}>
              {createPost.isPending ? "Posting..." : "Post"}
            </Button>
          </div>
        </div>
      )}

      {posts.length === 0 && !showForm && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">No discussions yet. Be the first to start one!</p>
        </div>
      )}

      <div className="grid gap-4">
        {posts.map((post: any) => (
          <div key={post.id} className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
            <div className="flex justify-between items-start">
              <div className="flex-1 cursor-pointer" onClick={() => setSelectedPost(selectedPost === post.id ? null : post.id)}>
                <h3 className="font-semibold text-foreground">{post.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{post.content}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{post.profiles?.display_name || "Anonymous"}</span>
                  <span>·</span>
                  <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                  <MessageSquare className="h-3 w-3 ml-2" />
                </div>
              </div>
              {post.user_id === user?.id && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => deletePost.mutate(post.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            {selectedPost === post.id && (
              <div className="mt-4 pt-4 border-t border-border space-y-3">
                {replies.map((reply: any) => (
                  <div key={reply.id} className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm text-foreground">{reply.content}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {reply.profiles?.display_name || "Anonymous"} · {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                    </p>
                  </div>
                ))}
                {replies.length === 0 && <p className="text-sm text-muted-foreground">No replies yet.</p>}
                <div className="flex gap-2">
                  <Input
                    placeholder="Write a reply..."
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && replyContent.trim() && createReply.mutate()}
                    className="flex-1"
                  />
                  <Button size="icon" onClick={() => createReply.mutate()} disabled={!replyContent.trim() || createReply.isPending}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
