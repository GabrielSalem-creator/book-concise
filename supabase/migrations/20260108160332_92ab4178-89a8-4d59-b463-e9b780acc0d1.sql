-- Add admin delete policies for all user-related tables

-- Profiles: allow admins to delete any profile
CREATE POLICY "Admins can delete any profile"
ON public.profiles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- User preferences: allow admins to manage any preferences
CREATE POLICY "Admins can view all preferences"
ON public.user_preferences
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any preferences"
ON public.user_preferences
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update any preferences"
ON public.user_preferences
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- User sessions: allow admins to delete any sessions
CREATE POLICY "Admins can delete any sessions"
ON public.user_sessions
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update any sessions"
ON public.user_sessions
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- User activity: allow admins to delete any activity
CREATE POLICY "Admins can delete any activity"
ON public.user_activity
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Reading sessions: allow admins to view and delete any reading sessions
CREATE POLICY "Admins can view all reading sessions"
ON public.reading_sessions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any reading sessions"
ON public.reading_sessions
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Bookmarks: allow admins to view and delete any bookmarks
CREATE POLICY "Admins can view all bookmarks"
ON public.bookmarks
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any bookmarks"
ON public.bookmarks
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Chat messages: allow admins to delete any messages
CREATE POLICY "Admins can view all chat messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any chat messages"
ON public.chat_messages
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Goals: allow admins to view and delete any goals
CREATE POLICY "Admins can view all goals"
ON public.goals
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any goals"
ON public.goals
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Reading plan books: allow admins to view and delete any reading plan books
CREATE POLICY "Admins can view all reading plan books"
ON public.reading_plan_books
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any reading plan books"
ON public.reading_plan_books
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Categories: allow admins to view and delete any categories
CREATE POLICY "Admins can view all categories"
ON public.categories
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any categories"
ON public.categories
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));