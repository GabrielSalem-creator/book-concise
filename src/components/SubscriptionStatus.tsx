import { Crown, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, formatDistanceToNow } from 'date-fns';

interface SubscriptionStatusProps {
  isPremium: boolean;
  expiresAt: string | null;
  pendingRequest?: any;
}

export const SubscriptionStatus = ({
  isPremium,
  expiresAt,
  pendingRequest,
}: SubscriptionStatusProps) => {
  if (isPremium && expiresAt) {
    const expiryDate = new Date(expiresAt);
    const isExpiringSoon = expiryDate.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

    return (
      <Card className="p-4 bg-gradient-to-r from-amber-500/20 to-amber-600/20 border-amber-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-amber-500/20">
              <Crown className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-amber-700 dark:text-amber-400">Premium Active</h3>
                <Badge className="bg-amber-500 text-white">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              </div>
              <p className="text-sm text-amber-600 dark:text-amber-300">
                Expires {format(expiryDate, 'MMM dd, yyyy')} ({formatDistanceToNow(expiryDate, { addSuffix: true })})
              </p>
            </div>
          </div>
          {isExpiringSoon && (
            <Badge variant="outline" className="border-amber-500 text-amber-500">
              <Clock className="w-3 h-3 mr-1" />
              Expiring Soon
            </Badge>
          )}
        </div>
      </Card>
    );
  }

  if (pendingRequest) {
    return (
      <Card className="p-4 bg-gradient-to-r from-blue-500/20 to-blue-600/20 border-blue-500/30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-blue-500/20">
            <Clock className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-blue-700 dark:text-blue-400">Payment Pending</h3>
              <Badge variant="outline" className="border-blue-500 text-blue-500">
                Awaiting Verification
              </Badge>
            </div>
            <p className="text-sm text-blue-600 dark:text-blue-300">
              Reference: <code className="font-mono">{pendingRequest.reference_code}</code> • 
              {pendingRequest.plan_type} plan • ${pendingRequest.amount}
            </p>
            <p className="text-xs text-blue-500 mt-1">
              Your payment is being verified. This usually takes less than 24 hours.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return null;
};
