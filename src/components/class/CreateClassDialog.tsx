
'use client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Loader2, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export function CreateClassDialogContent() {
  const [className, setClassName] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const handleCreateClass = async () => {
    if (!className.trim()) {
      toast({ variant: "destructive", title: "Class Name Required", description: "Please enter a name for your class." });
      return;
    }
    if (!currentUser) {
      toast({ variant: "destructive", title: "Authentication Error", description: "You must be signed in to create a class." });
      return;
    }
    setIsCreating(true);
    
    try {
      const classesCollectionRef = collection(db, "classes");
      await addDoc(classesCollectionRef, {
        name: className.trim(),
        description: description.trim(),
        subject: subject.trim(),
        creatorId: currentUser.uid,
        creatorName: currentUser.displayName || "Anonymous",
        createdAt: serverTimestamp(),
        members: [currentUser.uid], // Creator is the first member
        joinRequests: [],
      });

      toast({ title: "Class Created!", description: `The class "${className}" has been successfully created.` });
      setClassName("");
      setDescription("");
      setSubject("");
      // This part would be handled by DialogClose if it's the outermost component
      // In a real app, you might need a callback to tell the parent to close the dialog
    } catch (error) {
        console.error("Error creating class:", error);
        toast({ variant: "destructive", title: "Creation Failed", description: "Could not create the class. Please check console for details." });
    } finally {
        setIsCreating(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle><Users className="mr-2 h-6 w-6 text-primary inline-block" />Create a New Class</DialogTitle>
        <DialogDescription>Set up a new virtual classroom for your students.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div>
          <Label htmlFor="className" className="block text-sm font-medium text-muted-foreground mb-1">Class Name</Label>
          <Input id="className" placeholder="e.g., Biology 101, Advanced Calculus" value={className} onChange={(e) => setClassName(e.target.value)} className="rounded-lg text-base" disabled={isCreating} />
        </div>
        <div>
          <Label htmlFor="classSubject" className="block text-sm font-medium text-muted-foreground mb-1">Subject (Optional)</Label>
          <Input id="classSubject" placeholder="e.g., Mathematics, History" value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-lg text-base" disabled={isCreating} />
        </div>
        <div>
          <Label htmlFor="classDescription" className="block text-sm font-medium text-muted-foreground mb-1">Description (Optional)</Label>
          <Textarea id="classDescription" placeholder="A brief description of the class, its goals, or schedule." value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-lg" rows={3} disabled={isCreating} />
        </div>
      </div>
      <DialogFooter className="gap-2 sm:gap-0">
        <DialogClose asChild>
          <Button type="button" variant="outline" className="rounded-lg" disabled={isCreating}>Cancel</Button>
        </DialogClose>
        <DialogClose asChild>
            <Button type="button" onClick={handleCreateClass} className="btn-gel rounded-lg" disabled={!className.trim() || isCreating}>
            {isCreating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
            {isCreating ? "Creating..." : "Create Class"}
            </Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}
