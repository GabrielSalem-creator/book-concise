import { Copy, Check, CreditCard, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

interface PaymentDetails {
  referenceCode: string;
  planType: string;
  amount: number;
  currency: string;
  paymentDetails: {
    iban: string;
    swift: string;
    bankName: string;
    accountHolder: string;
  };
}

interface PaymentInstructionsModalProps {
  open: boolean;
  onClose: () => void;
  paymentDetails: PaymentDetails | null;
}

export const PaymentInstructionsModal = ({
  open,
  onClose,
  paymentDetails,
}: PaymentInstructionsModalProps) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!paymentDetails) return null;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast({
      title: 'Copied!',
      description: `${field} copied to clipboard`,
    });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const details = [
    { label: 'Bank Name', value: paymentDetails.paymentDetails.bankName, key: 'bank' },
    { label: 'Account Holder', value: paymentDetails.paymentDetails.accountHolder, key: 'holder' },
    { label: 'IBAN', value: paymentDetails.paymentDetails.iban, key: 'iban' },
    { label: 'SWIFT/BIC', value: paymentDetails.paymentDetails.swift, key: 'swift' },
    { label: 'Amount', value: `${paymentDetails.amount} ${paymentDetails.currency}`, key: 'amount' },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto mx-4 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Payment Instructions
          </DialogTitle>
          <DialogDescription>
            Complete your {paymentDetails.planType} subscription payment
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4">
          {/* Reference Code - Most Important */}
          <Card className="p-3 sm:p-4 bg-amber-500/10 border-amber-500/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium text-amber-700 dark:text-amber-400">
                Reference Code (IMPORTANT!)
              </span>
              <Badge variant="outline" className="bg-amber-500 text-white border-0 text-xs">
                Required
              </Badge>
            </div>
            <div className="flex items-center justify-between bg-background rounded-lg p-2 sm:p-3">
              <code className="text-base sm:text-xl font-bold tracking-wider break-all">
                {paymentDetails.referenceCode}
              </code>
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0 ml-2"
                onClick={() => copyToClipboard(paymentDetails.referenceCode, 'Reference Code')}
              >
                {copiedField === 'Reference Code' ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
              Include this code in your transfer notes/description
            </p>
          </Card>

          {/* Bank Details */}
          <div className="space-y-1.5 sm:space-y-2">
            {details.map((detail) => (
              <div
                key={detail.key}
                className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-muted/50"
              >
                <div className="min-w-0 flex-1 mr-2">
                  <p className="text-xs text-muted-foreground">{detail.label}</p>
                  <p className="font-medium text-sm sm:text-base break-all">{detail.value}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0"
                  onClick={() => copyToClipboard(detail.value, detail.label)}
                >
                  {copiedField === detail.label ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>

          {/* Instructions */}
          <Card className="p-3 sm:p-4 bg-blue-500/10 border-blue-500/30">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 mt-0.5 shrink-0" />
              <div className="text-xs sm:text-sm">
                <p className="font-medium text-blue-700 dark:text-blue-400 mb-1">
                  How to complete payment:
                </p>
                <ol className="list-decimal list-inside text-blue-600 dark:text-blue-300 space-y-0.5 sm:space-y-1">
                  <li>Open your banking app</li>
                  <li>Add a new transfer with the IBAN above</li>
                  <li>Enter the exact amount shown</li>
                  <li>
                    <strong>Include the reference code</strong> in the description
                  </li>
                  <li>Complete the transfer</li>
                </ol>
              </div>
            </div>
          </Card>

          <p className="text-xs text-center text-muted-foreground">
            Your premium access will be activated within 24 hours of receiving the payment.
            You'll be notified when your account is upgraded.
          </p>

          <Button className="w-full" onClick={onClose}>
            I've Made the Payment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
