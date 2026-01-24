import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Crown, Sparkles, Zap, Globe, Headphones, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { PaymentInstructionsModal } from '@/components/PaymentInstructionsModal';
import { SubscriptionStatus } from '@/components/SubscriptionStatus';

const PLANS = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: 9.99,
    currency: 'USD',
    period: '/month',
    description: 'Perfect for getting started',
    popular: false,
    features: [
      'Unlimited book summaries',
      'All languages supported',
      'Premium TTS voices',
      'Priority support',
      'No daily limits',
    ],
  },
  {
    id: 'yearly',
    name: 'Yearly',
    price: 79.99,
    currency: 'USD',
    period: '/year',
    description: 'Best value - Save 33%',
    popular: true,
    features: [
      'Everything in Monthly',
      '4 months FREE',
      'Early access to new features',
      'Exclusive premium content',
      'Priority feature requests',
    ],
  },
];

const PREMIUM_BENEFITS = [
  { icon: Zap, title: 'Unlimited Summaries', description: 'No more daily credit limits' },
  { icon: Globe, title: 'All Languages', description: 'Access to 50+ languages' },
  { icon: Headphones, title: 'Premium Voices', description: 'Natural-sounding TTS' },
  { icon: BookOpen, title: 'Full Library', description: 'Unlimited book access' },
];

const Pricing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [premiumExpiresAt, setPremiumExpiresAt] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<any>(null);

  useEffect(() => {
    if (user) {
      checkSubscriptionStatus();
    }
  }, [user]);

  const checkSubscriptionStatus = async () => {
    if (!user) return;

    // Check premium status
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('is_premium, premium_expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (prefs) {
      const isCurrentlyPremium = prefs.is_premium && 
        (!prefs.premium_expires_at || new Date(prefs.premium_expires_at) > new Date());
      setIsPremium(isCurrentlyPremium);
      setPremiumExpiresAt(prefs.premium_expires_at);
    }

    // Check pending requests
    const { data: pending } = await supabase
      .from('subscription_requests')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle();

    setPendingRequest(pending);
  };

  const handleSubscribe = async (planId: string) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    setSelectedPlan(planId);
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('create-subscription-request', {
        body: { planType: planId },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setPaymentDetails(response.data);
      setShowPaymentModal(true);
      
      // Refresh pending request status
      checkSubscriptionStatus();

    } catch (error: any) {
      console.error('Subscription error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create subscription request',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-morphism border-b border-primary/20">
        <div className="container mx-auto px-4 lg:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                <Crown className="w-6 h-6 text-amber-500" />
                <h1 className="text-xl font-bold">Upgrade to Premium</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 lg:px-6 py-12">
        {/* Current Status */}
        {user && (isPremium || pendingRequest) && (
          <div className="mb-8">
            <SubscriptionStatus 
              isPremium={isPremium} 
              expiresAt={premiumExpiresAt} 
              pendingRequest={pendingRequest}
            />
          </div>
        )}

        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 text-amber-600 mb-4">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">Unlock Your Full Potential</span>
          </div>
          <h2 className="text-4xl font-bold mb-4">
            Read More, Learn Faster
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get unlimited access to book summaries, premium voices, and all languages. 
            No more daily limits holding you back.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {PREMIUM_BENEFITS.map((benefit, index) => (
            <Card key={index} className="text-center p-4 bg-card/50 border-primary/10">
              <benefit.icon className="w-8 h-8 mx-auto mb-2 text-primary" />
              <h3 className="font-semibold text-sm">{benefit.title}</h3>
              <p className="text-xs text-muted-foreground">{benefit.description}</p>
            </Card>
          ))}
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-12">
          {PLANS.map((plan) => (
            <Card 
              key={plan.id}
              className={`relative overflow-hidden transition-all hover:shadow-xl ${
                plan.popular 
                  ? 'border-2 border-amber-500 shadow-amber-500/20' 
                  : 'border-primary/20'
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0">
                  <Badge className="rounded-none rounded-bl-lg bg-amber-500 text-white">
                    Most Popular
                  </Badge>
                </div>
              )}
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Crown className={`w-5 h-5 ${plan.popular ? 'text-amber-500' : 'text-primary'}`} />
                  {plan.name}
                </CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full ${plan.popular ? 'bg-amber-500 hover:bg-amber-600' : ''}`}
                  size="lg"
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={isLoading || isPremium || !!pendingRequest}
                >
                  {isLoading && selectedPlan === plan.id ? (
                    'Processing...'
                  ) : isPremium ? (
                    'Already Premium'
                  ) : pendingRequest ? (
                    'Payment Pending'
                  ) : (
                    `Get ${plan.name}`
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-2xl mx-auto">
          <h3 className="text-2xl font-bold text-center mb-6">Frequently Asked Questions</h3>
          <div className="space-y-4">
            <Card className="p-4">
              <h4 className="font-semibold mb-2">How does the payment work?</h4>
              <p className="text-sm text-muted-foreground">
                After selecting your plan, you'll receive our bank details (IBAN). 
                Simply transfer the amount with the reference code, and we'll activate your premium 
                within 24 hours of receiving the payment.
              </p>
            </Card>
            <Card className="p-4">
              <h4 className="font-semibold mb-2">What happens when my subscription ends?</h4>
              <p className="text-sm text-muted-foreground">
                Your account will return to the free plan with 2 daily credits. 
                You can renew anytime to get unlimited access again.
              </p>
            </Card>
            <Card className="p-4">
              <h4 className="font-semibold mb-2">Can I cancel anytime?</h4>
              <p className="text-sm text-muted-foreground">
                Yes! Since this is a one-time payment for the subscription period, 
                you simply don't renew when it expires. No auto-renewal, no hidden fees.
              </p>
            </Card>
          </div>
        </div>
      </main>

      {/* Payment Instructions Modal */}
      <PaymentInstructionsModal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        paymentDetails={paymentDetails}
      />
    </div>
  );
};

export default Pricing;
