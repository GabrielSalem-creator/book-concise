import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Database, Eye, Lock, Mail, Trash2, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const Privacy = () => {
  const navigate = useNavigate();

  const sections = [
    {
      icon: Database,
      title: "Data We Collect",
      content: [
        "**Account Information**: Email address and optional profile details (name, avatar) when you create an account.",
        "**Reading Activity**: Books you search for, summaries you generate, and reading progress to personalize your experience.",
        "**Usage Data**: How you interact with the app to improve our service (pages visited, features used).",
        "**Device Information**: Basic device type and browser for compatibility purposes."
      ]
    },
    {
      icon: Eye,
      title: "How We Use Your Data",
      content: [
        "**Personalization**: Recommend books and track your reading streaks.",
        "**Service Improvement**: Analyze usage patterns to enhance features.",
        "**Communication**: Send important account updates (you control marketing preferences).",
        "**AI Processing**: Generate book summaries using secure AI services - your data is not used to train AI models."
      ]
    },
    {
      icon: Lock,
      title: "Data Security",
      content: [
        "**Encryption**: All data is encrypted in transit (HTTPS/TLS) and at rest.",
        "**Secure Storage**: We use Supabase, a trusted database provider with enterprise-grade security.",
        "**Access Control**: Row-level security ensures you can only access your own data.",
        "**No Selling**: We never sell your personal data to third parties."
      ]
    },
    {
      icon: Globe,
      title: "Third-Party Services",
      content: [
        "**Supabase**: Database and authentication (privacy policy: supabase.com/privacy)",
        "**AI Services**: Book summaries are generated using secure AI APIs - text is processed but not stored by AI providers.",
        "**Azure TTS**: Text-to-speech for audio narration - audio is generated on-demand and not retained."
      ]
    },
    {
      icon: Trash2,
      title: "Your Rights",
      content: [
        "**Access**: View all data we store about you in your account settings.",
        "**Delete**: Request complete deletion of your account and all associated data.",
        "**Export**: Download your reading history and preferences.",
        "**Opt-out**: Disable analytics tracking in your account settings."
      ]
    },
    {
      icon: Mail,
      title: "Contact Us",
      content: [
        "For privacy questions or data requests, contact us through the app's feedback feature or your account settings.",
        "We respond to all privacy inquiries within 30 days."
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5">
      {/* Top spacing */}
      <div className="h-5 bg-background" />

      {/* Header */}
      <header className="sticky top-0 z-50 glass-morphism border-b border-primary/20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex items-center h-14 sm:h-16">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mr-3">
              <ArrowLeft className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-primary to-accent shadow-lg">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
              </div>
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Privacy Policy
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-3xl">
        {/* Intro */}
        <Card className="p-4 sm:p-6 mb-6 bg-primary/5 border-primary/20">
          <p className="text-sm sm:text-base text-foreground/80 leading-relaxed">
            At <span className="font-semibold text-primary">Nocturn</span>, we take your privacy seriously. 
            This policy explains what data we collect, how we use it, and your rights regarding your information.
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-3">
            Last updated: January 2025
          </p>
        </Card>

        {/* Sections */}
        <div className="space-y-4 sm:space-y-6">
          {sections.map((section, index) => (
            <Card key={index} className="p-4 sm:p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="p-2 sm:p-2.5 rounded-lg bg-primary/10 shrink-0">
                  <section.icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3">
                    {section.title}
                  </h2>
                  <ul className="space-y-2">
                    {section.content.map((item, itemIndex) => (
                      <li key={itemIndex} className="text-sm sm:text-base text-foreground/80 leading-relaxed">
                        {item.split('**').map((part, partIndex) => (
                          partIndex % 2 === 1 ? (
                            <span key={partIndex} className="font-medium text-foreground">{part}</span>
                          ) : (
                            <span key={partIndex}>{part}</span>
                          )
                        ))}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Separator className="my-6 sm:my-8" />

        {/* Footer note */}
        <div className="text-center text-xs sm:text-sm text-muted-foreground">
          <p>By using Nocturn, you agree to this privacy policy.</p>
          <p className="mt-1">We may update this policy periodically - check back for changes.</p>
        </div>
      </main>
    </div>
  );
};

export default Privacy;
