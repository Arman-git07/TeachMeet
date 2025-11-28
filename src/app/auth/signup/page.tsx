import React from 'react';
import { SignUpForm } from '@/components/auth/SignUpForm';
import AuthLayout from '../layout';

export default function SignUpPage() {
  return (
    <AuthLayout>
      <SignUpForm />
    </AuthLayout>
  );
}
