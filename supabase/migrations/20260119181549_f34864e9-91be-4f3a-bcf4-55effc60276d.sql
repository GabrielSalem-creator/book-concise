-- Add admin role for gabriel.salem2008@outlook.com
INSERT INTO public.user_roles (user_id, role)
VALUES ('c3b01626-352d-40aa-8d56-761f54e28819', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Create a unique constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_role_key'
    ) THEN
        ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;