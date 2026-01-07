import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

export const useActivityTracker = () => {
  const { user } = useAuth();
  const sessionIdRef = useRef<string | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) return;

    const startSession = async () => {
      // Create a new session
      const { data, error } = await supabase
        .from('user_sessions')
        .insert({
          user_id: user.id,
          is_active: true,
        })
        .select('id')
        .single();

      if (data && !error) {
        sessionIdRef.current = data.id;
      }
    };

    const updateHeartbeat = async () => {
      if (!sessionIdRef.current) return;

      await supabase
        .from('user_sessions')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', sessionIdRef.current);
    };

    const endSession = async () => {
      if (!sessionIdRef.current) return;

      await supabase
        .from('user_sessions')
        .update({
          is_active: false,
          ended_at: new Date().toISOString(),
        })
        .eq('id', sessionIdRef.current);
    };

    startSession();

    // Heartbeat every 30 seconds
    heartbeatRef.current = setInterval(updateHeartbeat, 30000);

    // Track page visibility
    const handleVisibilityChange = () => {
      if (document.hidden) {
        endSession();
      } else {
        startSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup on unmount
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      endSession();
    };
  }, [user]);

  const trackActivity = async (actionType: string, actionDetails?: Record<string, unknown>) => {
    if (!user) return;

    await supabase.from('user_activity').insert([{
      user_id: user.id,
      action_type: actionType,
      action_details: actionDetails as any || null,
    }]);
  };

  return { trackActivity };
};
