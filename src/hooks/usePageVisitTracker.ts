import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

export const usePageVisitTracker = () => {
  const { user } = useAuth();
  const location = useLocation();
  const lastPath = useRef<string>('');

  useEffect(() => {
    if (!user) return;
    if (location.pathname === lastPath.current) return;
    lastPath.current = location.pathname;

    supabase.from('user_activity').insert({
      user_id: user.id,
      action_type: 'page_visit',
      action_details: { page: location.pathname } as any,
    });
  }, [user, location.pathname]);
};
