-- Create subscription_requests table
CREATE TABLE public.subscription_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reference_code TEXT NOT NULL UNIQUE,
  plan_type TEXT NOT NULL DEFAULT 'monthly',
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending',
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add premium columns to user_preferences
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS on subscription_requests
ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscription requests
CREATE POLICY "Users can view their own subscription requests"
ON public.subscription_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own subscription requests
CREATE POLICY "Users can create their own subscription requests"
ON public.subscription_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all subscription requests
CREATE POLICY "Admins can view all subscription requests"
ON public.subscription_requests
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update any subscription requests
CREATE POLICY "Admins can update any subscription requests"
ON public.subscription_requests
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete any subscription requests
CREATE POLICY "Admins can delete any subscription requests"
ON public.subscription_requests
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_subscription_requests_updated_at
BEFORE UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();