import { SignUp } from '@clerk/clerk-react';

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <SignUp
        routing="path"
        path="/sign-up"
        afterSignUpUrl="/home"
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
