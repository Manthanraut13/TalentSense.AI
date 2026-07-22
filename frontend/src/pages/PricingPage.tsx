import { useUser } from '@clerk/clerk-react';
import { Check, Zap } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { createCheckoutSession } from '../lib/api';
import { useBillingStatus } from '../hooks/useBilling';

const FREE_FEATURES = [
  '5 analyses per day',
  'Match score breakdown',
  'Missing skills detection',
  'ATS keyword suggestions',
  'Analysis history',
];

const PRO_FEATURES = [
  'Unlimited analyses',
  'Everything in Free',
  'Full analysis history',
  'Future job URL import',
  'Future PDF report export',
  'Priority feature access',
];

export default function PricingPage() {
  const { user } = useUser();
  const { data: billing } = useBillingStatus();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const result = await createCheckoutSession({
        email: user.emailAddresses[0]?.emailAddress,
        successUrl: `${window.location.origin}/upgrade/success`,
        cancelUrl: `${window.location.origin}/pricing`,
      });
      window.location.href = result.checkout_url;
    } catch {
      setError('Checkout is not available yet. Confirm Stripe environment variables are configured.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Pricing</h1>
        <p className="mt-2 text-sm text-textSecondary">Start free. Upgrade when daily limits get in the way.</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <PlanPanel name="Free" price="$0" features={FREE_FEATURES}>
          <div className="rounded-md border border-line px-4 py-3 text-center text-sm text-textSecondary">
            {billing?.is_pro ? 'Included with Pro' : 'Current plan'}
          </div>
        </PlanPanel>

        <PlanPanel name="Pro" price="$9/mo" features={PRO_FEATURES} highlighted>
          {billing?.is_pro ? (
            <div className="rounded-md border border-primary/30 bg-primary-subtle px-4 py-3 text-center text-sm font-medium text-primary">
              Your current plan
            </div>
          ) : (
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Zap size={16} />
              {loading ? 'Redirecting...' : 'Upgrade to Pro'}
            </button>
          )}
        </PlanPanel>
      </div>

      {error ? (
        <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : null}
    </main>
  );
}

function PlanPanel({
  name,
  price,
  features,
  highlighted = false,
  children,
}: {
  name: string;
  price: string;
  features: string[];
  highlighted?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`rounded-lg border bg-surface p-6 ${highlighted ? 'border-primary' : 'border-line'}`}>
      <div className="mb-5">
        <h2 className="text-xl font-semibold">{name}</h2>
        <p className="mt-2 text-3xl font-bold">{price}</p>
      </div>
      <ul className="mb-6 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-sm text-textSecondary">
            <Check className="text-primary" size={16} />
            {feature}
          </li>
        ))}
      </ul>
      {children}
    </section>
  );
}
