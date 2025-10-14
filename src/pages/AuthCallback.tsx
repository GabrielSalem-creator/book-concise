import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleCallback = async () => {
      const url = new URL(window.location.href);
      const errorDescription = url.searchParams.get("error_description");
      if (errorDescription) {
        toast({
          title: "Authentication error",
          description: decodeURIComponent(errorDescription),
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      const code = url.searchParams.get("code");
      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          navigate("/dashboard", { replace: true });
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          navigate("/dashboard", { replace: true });
        } else {
          navigate("/auth", { replace: true });
        }
      } catch (err) {
        console.error("Auth callback error:", err);
        toast({
          title: "Login failed",
          description: err instanceof Error ? err.message : "Unable to complete sign-in.",
          variant: "destructive",
        });
        navigate("/auth", { replace: true });
      }
    };

    handleCallback();
  }, [navigate, toast]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 bg-card/50 backdrop-blur-sm border-2 text-center">
        <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Finishing sign-in…</p>
        <Button variant="ghost" className="mt-6" onClick={() => navigate("/auth")}>Back to Sign In</Button>
      </Card>
    </div>
  );
};

export default AuthCallback;
