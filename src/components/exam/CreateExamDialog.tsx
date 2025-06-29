
'use client';
import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { PlusCircle, Loader2, ShieldAlert } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";

// This would typically come from a user's data
const mockUserClasses = [
    { id: 'cls1', name: 'Introduction to Biology' },
    { id: 'cls2', name: 'Advanced Mathematics' },
];

export function CreateExamDialogContent() {
    const { toast } = useToast();
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!user) {
            toast({ variant: 'destructive', title: 'Not Authenticated', description: 'You must be signed in to create an exam.' });
            return;
        }

        setIsLoading(true);
        const formData = new FormData(event.currentTarget);
        const examData = {
            title: formData.get('examTitle') as string,
            classId: formData.get('classId') as string,
            instructions: formData.get('instructions') as string,
            duration: formData.get('duration') as string,
        };

        console.log("Attempting to create exam with data:", examData);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        toast({
            title: "Exam Created! (Mock)",
            description: `"${examData.title}" has been set up. You can now add questions.`,
        });
        setIsLoading(false);
    };

    return (
        <form onSubmit={handleSubmit}>
            <DialogHeader>
                <DialogTitle className="text-2xl flex items-center gap-2"><ShieldAlert/>Create a New Exam</DialogTitle>
                <DialogDescription>
                    Fill out the details below to set up a new exam for one of your classes.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-6">
                <div className="space-y-2">
                    <Label htmlFor="examTitle">Exam Title</Label>
                    <Input id="examTitle" name="examTitle" placeholder="e.g., Midterm Exam" required className="rounded-lg" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="classId">Class</Label>
                    <Select name="classId" required>
                        <SelectTrigger className="w-full rounded-lg">
                            <SelectValue placeholder="Select a class for this exam" />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg">
                            {mockUserClasses.map(cls => (
                                <SelectItem key={cls.id} value={cls.id} className="rounded-md">{cls.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="duration">Duration (in minutes)</Label>
                    <Input id="duration" name="duration" type="number" placeholder="e.g., 60" required className="rounded-lg" />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="instructions">Instructions</Label>
                    <Textarea id="instructions" name="instructions" placeholder="Provide instructions for the students taking the exam." className="rounded-lg"/>
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline" className="rounded-lg">Cancel</Button>
                </DialogClose>
                <Button type="submit" className="btn-gel rounded-lg" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isLoading ? 'Creating...' : 'Create Exam & Add Questions'}
                </Button>
            </DialogFooter>
        </form>
    );
}
