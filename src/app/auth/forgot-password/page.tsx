
'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useState } from 'react';

const formSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
});

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      // Regardless of the outcome, we tell the user to check their email.
      // This prevents user enumeration attacks where an attacker could check which emails are registered.
      await sendPasswordResetEmail(auth, values.email);
      toast({
        title: "Password Reset Email Sent",
        description: `If an account exists for ${values.email}, you will receive instructions to reset your password.`,
      });
      form.reset();
    } catch (error: any) {
      // We still show a generic success message to the user for security.
      // But we log the actual error for debugging purposes.
      console.error("Forgot Password Error:", error);
       toast({
        title: "Password Reset Email Sent",
        description: `If an account exists for ${values.email}, you will receive instructions to reset your password.`,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Forgot Your Password?</h2>
          <p className="text-sm text-muted-foreground mt-1">
            No worries! Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground/80">Email Address</FormLabel>
              <FormControl>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="you@example.com" {...field} className="pl-10 rounded-lg text-base" disabled={isLoading} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full btn-gel text-base py-3 rounded-lg" disabled={isLoading}>
          {isLoading ? 'Sending Link...' : 'Send Reset Link'}
        </Button>
        <div className="text-center text-sm text-muted-foreground">
          Remembered your password?{' '}
          <Link href="/auth/signin" className="font-medium text-accent hover:text-accent/80 hover:underline">
            Sign In
          </Link>
        </div>
      </form>
    </Form>
  );
}

