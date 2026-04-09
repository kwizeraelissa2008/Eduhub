
-- Learning topics (user-defined subjects)
CREATE TABLE public.learning_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  roadmap JSONB,
  progress_percent NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.learning_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own topics (select)" ON public.learning_topics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own topics (insert)" ON public.learning_topics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own topics (update)" ON public.learning_topics FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users manage own topics (delete)" ON public.learning_topics FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_learning_topics_updated_at BEFORE UPDATE ON public.learning_topics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Uploaded files
CREATE TABLE public.uploaded_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  topic_id UUID REFERENCES public.learning_topics(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,
  extracted_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.uploaded_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own files (select)" ON public.uploaded_files FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own files (insert)" ON public.uploaded_files FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own files (update)" ON public.uploaded_files FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users manage own files (delete)" ON public.uploaded_files FOR DELETE USING (auth.uid() = user_id);

-- Generated lessons
CREATE TABLE public.generated_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  topic_id UUID REFERENCES public.learning_topics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  lesson_order INTEGER NOT NULL DEFAULT 1,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.generated_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own lessons (select)" ON public.generated_lessons FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own lessons (insert)" ON public.generated_lessons FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own lessons (update)" ON public.generated_lessons FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users manage own lessons (delete)" ON public.generated_lessons FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_generated_lessons_updated_at BEFORE UPDATE ON public.generated_lessons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Quiz results
CREATE TABLE public.quiz_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  topic_id UUID REFERENCES public.learning_topics(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own quizzes (select)" ON public.quiz_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own quizzes (insert)" ON public.quiz_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own quizzes (delete)" ON public.quiz_results FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket for user uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('user-uploads', 'user-uploads', false);
CREATE POLICY "Users upload own files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'user-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users view own files" ON storage.objects FOR SELECT USING (bucket_id = 'user-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own files" ON storage.objects FOR DELETE USING (bucket_id = 'user-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
