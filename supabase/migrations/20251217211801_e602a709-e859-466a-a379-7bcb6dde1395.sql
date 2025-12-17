-- Add delete policy for reading_plan_books
CREATE POLICY "Users can delete their reading plan books" 
ON public.reading_plan_books 
FOR DELETE 
USING (EXISTS ( SELECT 1
   FROM goals
  WHERE ((goals.id = reading_plan_books.goal_id) AND (goals.user_id = auth.uid()))));