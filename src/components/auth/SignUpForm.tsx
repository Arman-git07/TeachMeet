
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
import { Mail, Lock, User, CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useState } from 'react';
import { Checkbox } from '../ui/checkbox';
import { cn } from '@/lib/utils';
import { disposableEmailDomains } from '@/lib/disposable-emails';


const formSchema = z.object({
  profileName: z.string().min(1, { message: 'Profile name is required.' }),
  email: z.string().email({ message: 'Invalid email address.' }).refine(email => {
    const domain = email.split('@')[1];
    return !disposableEmailDomains.includes(domain);
  }, {
    message: "Temporary or disposable email addresses are not allowed."
  }),
  password: z.string()
    .min(8, { message: 'Password must be at least 8 characters.' })
    .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter.' })
    .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter.' })
    .regex(/[0-9]/, { message: 'Password must contain at least one number.' })
    .regex(/[^a-zA-Z0-9]/, { message: 'Password must contain at least one special character.' }),
  confirmPassword: z.string(),
  dateOfBirth: z.string().optional(), // Optional for now, browser's date input handles format
  agreeToTerms: z.boolean().refine(val => val === true, {
    message: "You must agree to the Terms of Service and Privacy Policy.",
  }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match.",
  path: ['confirmPassword'],
});

export function SignUpForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isVerificationSent, setIsVerificationSent] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      profileName: '',
      email: '',
      password: '',
      confirmPassword: '',
      dateOfBirth: '',
      agreeToTerms: false,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      
      if (userCredential.user) {
        await updateProfile(userCredential.user, {
          displayName: values.profileName,
        });
        
        await sendEmailVerification(userCredential.user);
        
        toast({
          title: "Verification Email Sent",
          description: `A verification link has been sent to ${values.email}. Please check your inbox.`,
          duration: 10000,
        });

        setIsVerificationSent(true); 
      }
      
    } catch (error: any) {
      if (error.code === 'auth/network-request-failed') {
        toast({
          variant: "destructive",
          title: "Network Error",
          description: "Could not connect to authentication services. This might be a network issue or a missing API configuration. Please check the developer console for details.",
          duration: 7000,
        });
        setIsLoading(false);
        return;
      }
      if (error.code && error.code.startsWith('auth/requests-to-this-api')) {
         toast({
          variant: "destructive",
          title: "API Key Error",
          description: "Authentication is blocked by your API key settings. Ensure the 'Identity Toolkit API' is enabled and allowed by your key.",
          duration: 7000,
        });
        setIsLoading(false);
        return;
      }

      const knownErrorCodes = [
        'auth/email-already-in-use',
        'auth/invalid-email',
        'auth/weak-password'
      ];

      if (knownErrorCodes.includes(error.code)) {
        console.info(`Handled Sign Up Error: ${error.code}`);
      } else {
        console.error("Unexpected Sign Up Error:", error);
      }
      
      let errorMessage = "An unexpected error occurred. Please try again.";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "This email address is already in use. Please try another.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "The email address is not valid.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "The password is too weak. Please choose a stronger password.";
      }
      toast({
        variant: "destructive",
        title: "Sign Up Failed",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }
  
  if (isVerificationSent) {
    return (
      <div className="text-center space-y-6">
        <Mail className="mx-auto h-12 w-12 text-primary" />
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Verify Your Email</h2>
        <p className="text-muted-foreground">
          We've sent a verification link to your email address. Please click the link in the email to activate your account.
        </p>
        <Button asChild className="w-full btn-gel text-base py-3 rounded-lg">
          <Link href="/auth/signin">Back to Sign In</Link>
        </Button>
         <p className="text-xs text-muted-foreground">
            Didn't receive an email? Check your spam folder.
        </p>
      </div>
    );
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="profileName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground/80">Profile Name</FormLabel>
                <FormControl>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Your Name" {...field} className="pl-10 rounded-lg text-base" disabled={isLoading}/>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground/80">Email Address</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="you@example.com" {...field} className="pl-10 rounded-lg text-base" disabled={isLoading}/>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dateOfBirth"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground/80">Date of Birth</FormLabel>
                <FormControl>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input 
                      type="date" 
                      placeholder="YYYY-MM-DD" 
                      {...field} 
                      className="pl-10 rounded-lg text-base" 
                      disabled={isLoading}
                      // To prevent future dates, you could add max={new Date().toISOString().split("T")[0]}
                    />
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
                    <Input type="password" placeholder="••••••••" {...field} className="pl-10 rounded-lg text-base" disabled={isLoading}/>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground/80">Confirm Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input type="password" placeholder="••••••••" {...field} className="pl-10 rounded-lg text-base" disabled={isLoading}/>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="agreeToTerms"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border p-4 shadow-sm bg-background/50">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isLoading}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-sm text-muted-foreground">
                    I agree to the TeachMeet{' '}
                    <Link href="/terms-of-service" target="_blank" className="text-accent hover:underline">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link href="/privacy-policy" target="_blank" className="text-accent hover:underline">
                      Privacy Policy
                    </Link>
                    .
                  </FormLabel>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full btn-gel text-base py-3 rounded-lg mt-6" disabled={isLoading}>
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </Button>
          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/auth/signin" className="font-medium text-accent hover:text-accent/80 hover:underline">
              Sign In
            </Link>
          </div>
        </form>
      </Form>
    </>
  );
}
