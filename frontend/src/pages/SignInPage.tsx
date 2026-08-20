import { SignIn } from '@clerk/clerk-react';

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <SignIn
        routing="path"
        path="/sign-in"
        afterSignInUrl="/home"
        appearance={{
          variables: {
            colorPrimary: '#0EA5A0',
            colorBackground: '#F0F4F8',
            colorText: '#171D1C',
            colorInputBackground: '#FFFFFF',
            colorInputText: '#171D1C',
          },
          elements: {
            card: 'bg-surface border border-line rounded-2xl shadow-cardLg',
            formButtonPrimary: 'bg-primary hover:bg-primary-hover text-white',
          },
        }}
      />
    </div>
  );
}
