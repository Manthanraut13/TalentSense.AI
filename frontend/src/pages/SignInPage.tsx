import { SignIn } from '@clerk/clerk-react';

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <SignIn
        routing="path"
        path="/sign-in"
        afterSignInUrl="/"
        appearance={{
          variables: {
            colorPrimary: '#10B981',
            colorBackground: '#1A1A1A',
            colorText: '#F5F5F5',
            colorInputBackground: '#242424',
            colorInputText: '#F5F5F5',
          },
          elements: {
            card: 'bg-surface border border-line',
            formButtonPrimary: 'bg-primary hover:bg-primary-hover',
          },
        }}
      />
    </div>
  );
}
