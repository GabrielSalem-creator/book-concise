import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Sparkles, Library, Users, Zap, TrendingUp, BookMarked, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/components/AuthProvider";

const Landing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center space-y-8 max-w-4xl mx-auto mb-20">
          <div className="flex items-center justify-center space-x-4 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <BookOpen className="w-16 h-16 text-primary" />
            <Sparkles className="w-12 h-12 text-accent animate-pulse" />
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            Transform Books Into Actionable Knowledge
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            AI-powered summaries that capture the essence of any book. Read or listen in minutes, not hours.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="h-14 px-8 text-lg bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Get Started Free
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/explore")}
              className="h-14 px-8 text-lg border-2 hover:bg-accent/10"
            >
              Explore Summaries
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 md:gap-8 mt-16 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-400">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary">10K+</div>
              <div className="text-sm md:text-base text-muted-foreground">Books Summarized</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-accent">5K+</div>
              <div className="text-sm md:text-base text-muted-foreground">Active Readers</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary">95%</div>
              <div className="text-sm md:text-base text-muted-foreground">Time Saved</div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mb-20">
          <Card className="p-8 bg-card/50 backdrop-blur-sm border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
            <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <Zap className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Lightning Fast</h3>
            <p className="text-muted-foreground">
              Get comprehensive book summaries in seconds using advanced AI technology
            </p>
          </Card>

          <Card className="p-8 bg-card/50 backdrop-blur-sm border-2 hover:border-accent/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-600">
            <div className="w-14 h-14 bg-gradient-to-br from-accent/20 to-accent/10 rounded-2xl flex items-center justify-center mb-4">
              <Volume2 className="w-7 h-7 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Read or Listen</h3>
            <p className="text-muted-foreground">
              Choose to read the summary or have it narrated with natural text-to-speech
            </p>
          </Card>

          <Card className="p-8 bg-card/50 backdrop-blur-sm border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-700">
            <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <BookMarked className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Save & Organize</h3>
            <p className="text-muted-foreground">
              Build your personal library and bookmark summaries for later reference
            </p>
          </Card>

          <Card className="p-8 bg-card/50 backdrop-blur-sm border-2 hover:border-accent/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-800">
            <div className="w-14 h-14 bg-gradient-to-br from-accent/20 to-accent/10 rounded-2xl flex items-center justify-center mb-4">
              <Users className="w-7 h-7 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Community Library</h3>
            <p className="text-muted-foreground">
              Access thousands of summaries generated by our community of readers
            </p>
          </Card>

          <Card className="p-8 bg-card/50 backdrop-blur-sm border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-900">
            <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <Library className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Smart Search</h3>
            <p className="text-muted-foreground">
              Find books instantly and check if summaries already exist before generating
            </p>
          </Card>

          <Card className="p-8 bg-card/50 backdrop-blur-sm border-2 hover:border-accent/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-1000">
            <div className="w-14 h-14 bg-gradient-to-br from-accent/20 to-accent/10 rounded-2xl flex items-center justify-center mb-4">
              <TrendingUp className="w-7 h-7 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Track Progress</h3>
            <p className="text-muted-foreground">
              Monitor your reading journey and discover trending books in your field
            </p>
          </Card>
        </div>

        {/* CTA Section */}
        <Card className="p-12 bg-gradient-to-br from-primary/10 to-accent/10 backdrop-blur-sm border-2 border-primary/20 text-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-1100">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Transform Your Reading?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of readers who are learning faster and retaining more with AI-powered summaries
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/auth")}
            className="h-14 px-12 text-lg bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-lg hover:shadow-xl transition-all duration-300"
          >
            Start Reading Smarter Today
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default Landing;
