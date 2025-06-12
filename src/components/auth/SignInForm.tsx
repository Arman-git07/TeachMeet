
'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { HelpCircle, Mail, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useState } from 'react';

const formSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

export function SignInForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      toast({
        title: "Sign In Successful",
        description: "Welcome back!",
      });
      router.push('/'); // Changed from '/dashboard' to '/'
    } catch (error: any) {
      const knownErrorCodes = [
        'auth/user-not-found', 
        'auth/wrong-password', 
        'auth/invalid-credential', 
        'auth/invalid-email', 
        'auth/too-many-requests',
        'auth/visibility-check-was-unavailable.-please-retry-the-request-and-contact-support-if-the-problem-persists'
      ];

      if (!knownErrorCodes.includes(error.code)) {
        console.error("Unexpected Sign In Error:", error);
      } else {
        console.info(`Handled Sign In Error: ${error.code}`);
      }

      let errorMessage = "An unexpected error occurred. Please try again.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = "Invalid email or password. Please try again.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "The email address is not valid.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many failed login attempts. Please try again later or reset your password.";
      } else if (error.code === 'auth/visibility-check-was-unavailable.-please-retry-the-request-and-contact-support-if-the-problem-persists') {
        errorMessage = "There was a temporary issue with the authentication service. Please try signing in again in a moment. If the problem continues, check your network connection or browser settings.";
      }
      
      toast({
        variant: "destructive",
        title: "Sign In Failed",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground/80">Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input type="password" placeholder="••••••••" {...field} className="pl-10 rounded-lg text-base" disabled={isLoading} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex items-center justify-between text-sm">
          <Link href="/auth/forgot-password" className="font-medium text-accent hover:text-accent/80 hover:underline">
            Forgot password?
          </Link>
          <Link href="/help" className="flex items-center text-muted-foreground hover:text-accent hover:underline">
            <HelpCircle className="h-4 w-4 mr-1" />
            Help
          </Link>
        </div>
        <Button type="submit" className="w-full btn-gel text-base py-3 rounded-lg" disabled={isLoading}>
          {isLoading ? 'Signing In...' : 'Sign In'}
        </Button>
        <div className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="font-medium text-accent hover:text-accent/80 hover:underline">
            Sign Up
          </Link>
        </div>
      </form>
    </Form>
  );
}
