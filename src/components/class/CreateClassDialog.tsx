
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Loader2, UploadCloud } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { db, storage } from '@/lib/firebase';
import { addDoc, collection } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';

const formSchema = z.object({
  name: z.string().min(1, { message: 'Class name is required.' }).max(100, { message: 'Class name is too long.' }),
  subject: z.string().min(1, { message: 'Subject is required.' }).max(50, { message: 'Subject is too long.' }),
  description: z.string().max(300, { message: 'Description is too long.' }).optional(),
  classPicture: z.instanceof(File).optional(),
});

type CreateClassDialogContentProps = {
  setDialogOpen: (open: boolean) => void;
};

export function CreateClassDialogContent({ setDialogOpen }: CreateClassDialogContentProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { user } = useAuth();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      subject: '',
      description: '',
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          variant: 'destructive',
          title: 'Image too large',
          description: 'Please select an image smaller than 5MB.',
        });
        return;
      }
      form.setValue('classPicture', file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
      toast({ variant: "destructive", title: "Not authenticated", description: "You must be logged in to create a class." });
      return;
    }
    setIsLoading(true);
    try {
      let pictureUrl: string | undefined = undefined;
      if (values.classPicture) {
        const pictureRef = storageRef(storage, `class-pictures/${user.uid}/${Date.now()}-${values.classPicture.name}`);
        const snapshot = await uploadBytes(pictureRef, values.classPicture);
        pictureUrl = await getDownloadURL(snapshot.ref);
      }

      await addDoc(collection(db, 'classes'), {
        hostId: user.uid,
        name: values.name,
        subject: values.subject,
        description: values.description || '',
        pictureUrl: pictureUrl,
        memberCount: 1, // Start with the host as a member
        createdAt: new Date(),
      });
      
      toast({
        title: "Class Created!",
        description: `The class "${values.name}" has been successfully created.`,
      });
      form.reset();
      setDialogOpen(false); // Close the dialog on success
    } catch (error: any) {
      console.error("Error creating class:", error);
      toast({
        variant: "destructive",
        title: "Error Creating Class",
        description: error.message || "An unexpected error occurred.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Class Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Algebra 101" {...field} className="rounded-lg" disabled={isLoading} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="subject"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Subject</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Mathematics" {...field} className="rounded-lg" disabled={isLoading} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="A brief description of your class" {...field} className="rounded-lg" disabled={isLoading} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="classPicture"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Class Picture (Optional)</FormLabel>
              <FormControl>
                <Input id="picture" type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </FormControl>
              <label htmlFor="picture" className="w-full border-2 border-dashed border-border hover:border-primary transition-colors rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer">
                {imagePreview ? (
                    <div className="relative w-full h-32">
                        <Image src={imagePreview} alt="Class picture preview" layout="fill" objectFit="contain" className="rounded-md" />
                    </div>
                ) : (
                    <>
                        <UploadCloud className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">Click to upload an image</span>
                        <span className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF up to 5MB</span>
                    </>
                )}
              </label>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end pt-4">
          <Button type="submit" className="btn-gel rounded-lg" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isLoading ? 'Creating...' : 'Create Class'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
