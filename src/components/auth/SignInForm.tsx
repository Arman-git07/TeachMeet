
'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';

const formSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

export function SignInForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showSetupError, setShowSetupError] = useState<boolean>(false);
  const [showNetworkError, setShowNetworkError] = useState<boolean>(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setShowSetupError(false);
    setShowNetworkError(false);
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      toast({
        title: "Sign In Successful",
        description: "Welcome back!",
      });
      router.push('/');
    } catch (error: any) {
      if (error.code === 'auth/network-request-failed') {
        setShowNetworkError(true);
        setIsLoading(false);
        return;
      }
      if (error.code && error.code.startsWith('auth/requests-to-this-api')) {
        setShowSetupError(true);
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
      if (error.code === 'auth/user-not-found' || error.code === 'wrong-password' || error.code === 'invalid-credential') {
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
    <>
      {showNetworkError && (
         <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Action Required: Enable Authentication API</AlertTitle>
            <AlertDescription>
                <div className="space-y-2">
                    <p>Authentication is blocked due to a network error, which usually means the <strong>Identity Toolkit API</strong> is not enabled in your Google Cloud project. This is a required step for Firebase Authentication to work.</p>
                    <a href={`https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com?project=${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), "w-full mt-2")}>
                        Enable Identity Toolkit API &rarr;
                    </a>
                    <p className="text-xs text-muted-foreground">After enabling, please wait a minute and try signing in again.</p>
                </div>
            </AlertDescription>
        </Alert>
      )}
      {showSetupError && (
         <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Authentication Blocked: Check API Key</AlertTitle>
            <AlertDescription>
                <div className="space-y-2">
                    <p>You've enabled the API, which is great! The final step is to ensure your API key is not restricted.</p>
                    <ol className="list-decimal list-inside text-xs space-y-1">
                        <li>Find the API key in your project's <code>.env</code> file.</li>
                        <li>Go to your project's API Credentials page.</li>
                        <li>Click on the key name to edit it.</li>
                        <li>Under <strong>API restrictions</strong>, ensure that <strong>Identity Toolkit API</strong> is on the list of allowed APIs. If "Don't restrict key" is selected, this check is passed.</li>
                    </ol>
                    <a href={`https://console.cloud.google.com/apis/credentials?project=${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), "w-full mt-2")}>
                        Go to API Credentials &rarr;
                    </a>
                </div>
            </AlertDescription>
        </Alert>
      )}
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
    </>
  );
}
