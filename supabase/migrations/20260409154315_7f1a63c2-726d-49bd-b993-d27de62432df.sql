
-- Course modules table
CREATE TABLE public.course_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  module_number INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  content TEXT,
  estimated_minutes INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Modules visible to all" ON public.course_modules FOR SELECT USING (true);

-- Discussion posts
CREATE TABLE public.discussion_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  likes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.discussion_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view posts" ON public.discussion_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create own posts" ON public.discussion_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own posts" ON public.discussion_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own posts" ON public.discussion_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Discussion replies
CREATE TABLE public.discussion_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.discussion_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.discussion_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view replies" ON public.discussion_replies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create own replies" ON public.discussion_replies FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own replies" ON public.discussion_replies FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own replies" ON public.discussion_replies FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Chat messages for AI tutor
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own messages" ON public.chat_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Enable realtime for community
ALTER PUBLICATION supabase_realtime ADD TABLE public.discussion_posts;

-- Seed course modules for existing courses
INSERT INTO public.course_modules (course_id, module_number, title, content, estimated_minutes)
SELECT c.id, g.n, 
  'Module ' || g.n || ': ' || CASE g.n 
    WHEN 1 THEN 'Introduction & Setup'
    WHEN 2 THEN 'Core Concepts'
    WHEN 3 THEN 'Practical Exercises'
    WHEN 4 THEN 'Advanced Topics'
    WHEN 5 THEN 'Final Project'
    WHEN 6 THEN 'Review & Assessment'
    WHEN 7 THEN 'Extended Practice'
    WHEN 8 THEN 'Capstone'
    ELSE 'Additional Content'
  END,
  'Lesson content for module ' || g.n || ' of ' || c.title || '. This module covers important concepts and hands-on exercises.',
  CASE WHEN g.n <= 2 THEN 30 WHEN g.n <= 4 THEN 45 ELSE 60 END
FROM public.courses c
CROSS JOIN generate_series(1, c.total_modules) AS g(n);
