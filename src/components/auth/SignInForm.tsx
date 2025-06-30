
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
import { HelpCircle, Mail, Lock, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const formSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

export function SignInForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setApiError(null);
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      toast({
        title: "Sign In Successful",
        description: "Welcome back!",
      });
      router.push('/');
    } catch (error: any) {
      if (error.code && error.code.startsWith('auth/requests-to-this-api')) {
        setApiError("Identity Toolkit API setup issue.");
        setIsLoading(false);
        return; 
      }

      const knownErrorCodes = [
        'auth/user-not-found', 
        'auth/wrong-password', 
        'auth/invalid-credential', 
        'auth/invalid-email', 
        'auth/too-many-requests',
        'auth/visibility-check-was-unavailable'
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
      } else if (error.code === 'auth/visibility-check-was-unavailable') {
        errorMessage = "There was a temporary issue with the authentication service. This can sometimes be caused by network issues or ad-blocking browser extensions. Please try signing in again in a moment.";
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
        {apiError && (
            <Alert variant="destructive" className="my-4 text-left">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Authentication Setup Required</AlertTitle>
                <AlertDescription>
                    <p className="mb-3">You've enabled the API, which is great! This error means there's another project setting that needs attention. Please check the following:</p>
                    <ul className="list-decimal list-inside space-y-2">
                        <li>
                            <strong>Billing Enabled:</strong> Is billing enabled for your Google Cloud project? Some APIs require a billing account to be linked, even if their usage falls within the free tier.
                            <a href={`https://console.cloud.google.com/billing?project=${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`} target="_blank" rel="noopener noreferrer" className="font-bold underline ml-1">Check Billing Here</a>
                        </li>
                        <li>
                            <strong>Browser Extensions:</strong> Try signing in using an Incognito or Private window. This disables most browser extensions, which can sometimes interfere with authentication.
                        </li>
                         <li>
                            <strong>Wait and Refresh:</strong> If you just enabled billing or the API, it can sometimes take 5-10 minutes to take effect.
                        </li>
                    </ul>
                </AlertDescription>
            </Alert>
        )}
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
