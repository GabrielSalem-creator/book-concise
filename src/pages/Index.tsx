import { useState } from "react";
import { BookOpen, Sparkles } from "lucide-react";
import { BookSearch } from "@/components/BookSearch";
import { SummaryDisplay } from "@/components/SummaryDisplay";

const Index = () => {
  const [summary, setSummary] = useState<string>("");
  const [bookTitle, setBookTitle] = useState<string>("");

  const handleSummaryGenerated = (newSummary: string, title: string) => {
    setSummary(newSummary);
    setBookTitle(title);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-12">
        <div className="text-center space-y-4 mb-12">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <BookOpen className="w-12 h-12 text-primary" />
            <Sparkles className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
            BookConcise
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Transform any book into a concise, AI-powered summary. Search, extract, and listen to key insights in seconds.
          </p>
        </div>

        {/* Search Component */}
        <div className="max-w-4xl mx-auto mb-12">
          <BookSearch onSummaryGenerated={handleSummaryGenerated} />
        </div>

        {/* Summary Display */}
        {summary && (
          <div className="max-w-4xl mx-auto">
            <SummaryDisplay summary={summary} bookTitle={bookTitle} />
          </div>
        )}

        {/* Features */}
        {!summary && (
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mt-16">
            <div className="p-6 bg-card/30 backdrop-blur-sm rounded-lg border-2 border-border/50 hover:border-primary/50 transition-all duration-300">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Smart Search</h3>
              <p className="text-muted-foreground">
                Find any book's PDF instantly with our intelligent search system
              </p>
            </div>

            <div className="p-6 bg-card/30 backdrop-blur-sm rounded-lg border-2 border-border/50 hover:border-primary/50 transition-all duration-300">
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-2">AI Summaries</h3>
              <p className="text-muted-foreground">
                Get comprehensive summaries powered by advanced AI technology
              </p>
            </div>

            <div className="p-6 bg-card/30 backdrop-blur-sm rounded-lg border-2 border-border/50 hover:border-primary/50 transition-all duration-300">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Read or Listen</h3>
              <p className="text-muted-foreground">
                Choose to read the summary or have it narrated with text-to-speech
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
