
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
import { HelpCircle, Mail, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

export default function SignInPage() {
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
    
    // Set persistence before signing in to ensure session is saved.
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        // After setting persistence, perform sign-in
        return signInWithEmailAndPassword(auth, values.email, values.password);
      })
      .then((userCredential) => {
        toast({
          title: "Sign In Successful",
          description: "Welcome back!",
        });
        router.push('/');
      })
      .catch((error: any) => {
        console.error("Auth persistence or sign-in failed:", error);
  
        let errorMessage = "An unexpected error occurred. Please try again.";
        switch (error.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            errorMessage = "Invalid email or password. Please try again.";
            break;
          case 'auth/invalid-email':
            errorMessage = "The email address is not valid.";
            break;
          case 'auth/too-many-requests':
            errorMessage = "Too many failed login attempts. Please try again later or reset your password.";
            break;
          case 'auth/network-request-failed':
            errorMessage = "Network error. Could not connect to authentication services. Please check your internet connection and ensure Firebase API keys are correctly configured in your .env file.";
            break;
          default:
             if (error.code && error.code.match(/auth\/requests-to-this-api-.*/)) {
                errorMessage = "Authentication is temporarily unavailable. This may be due to an incorrect or restricted API key. Please check your Firebase project configuration and ensure the Identity Toolkit API is enabled.";
             } else if (error.message && error.message.includes("API key")) {
                errorMessage = "There is an issue with the API key configuration. Please ensure it is correct, valid, and unrestricted in your .env file and Google Cloud Console.";
             }
             break;
        }
        
        toast({
          variant: "destructive",
          title: "Sign In Failed",
          description: errorMessage,
          duration: 7000
        });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  return (
    <>
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
