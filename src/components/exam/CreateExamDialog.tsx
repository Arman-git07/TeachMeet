
'use client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Loader2, FileText } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CreateExamDialogContent() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"Quiz" | "Test" | "Exam" | "Multiple Choice Questions">("Quiz");
  const [dueDate, setDueDate] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const handleCreateExam = async () => {
    if (!title.trim()) {
      toast({
        variant: "destructive",
        title: "Title Required",
        description: "Please enter a title for the test/exam.",
      });
      return;
    }
    if (!dueDate) {
        toast({
          variant: "destructive",
          title: "Due Date Required",
          description: "Please select a due date.",
        });
        return;
      }
    setIsCreating(true);
    
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast({
      title: "Test/Exam Created!",
      description: `The ${type.toLowerCase()} "${title}" has been created.`,
    });
    
    setIsCreating(false);
    setTitle("");
    setDescription("");
    setDueDate("");
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          <FileText className="mr-2 h-6 w-6 text-primary inline-block" />
          Create New Test or Exam
        </DialogTitle>
        <DialogDescription>
          Fill out the details below to create a new assessment for your class.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div>
          <Label htmlFor="examTitle">Title</Label>
          <Input
            id="examTitle"
            placeholder="e.g., Chapter 5 Quiz, Final Exam"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-lg mt-1"
            disabled={isCreating}
          />
        </div>

        <div>
            <Label htmlFor="examType">Type</Label>
            <Select onValueChange={(value) => setType(value as "Quiz" | "Test" | "Exam" | "Multiple Choice Questions")} defaultValue={type} disabled={isCreating}>
                <SelectTrigger className="w-full mt-1 rounded-lg">
                    <SelectValue placeholder="Select an assessment type" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                    <SelectItem value="Quiz" className="rounded-md">Quiz</SelectItem>
                    <SelectItem value="Test" className="rounded-md">Test</SelectItem>
                    <SelectItem value="Exam" className="rounded-md">Exam</SelectItem>
                    <SelectItem value="Multiple Choice Questions" className="rounded-md">Multiple Choice Questions</SelectItem>
                </SelectContent>
            </Select>
        </div>

        <div>
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="rounded-lg mt-1"
                disabled={isCreating}
            />
        </div>

        <div>
          <Label htmlFor="examDescription">Description / Instructions (Optional)</Label>
          <Textarea
            id="examDescription"
            placeholder="Provide instructions, topics covered, etc."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-lg mt-1"
            rows={4}
            disabled={isCreating}
          />
        </div>
      </div>
      <DialogFooter className="gap-2 sm:gap-0">
        <DialogClose asChild>
          <Button type="button" variant="outline" className="rounded-lg" disabled={isCreating}>
            Cancel
          </Button>
        </DialogClose>
        <Button 
          type="button" 
          onClick={handleCreateExam} 
          className="btn-gel rounded-lg" 
          disabled={!title.trim() || !dueDate || isCreating}
        >
          {isCreating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
          {isCreating ? "Creating..." : "Create"}
        </Button>
      </DialogFooter>
    </>
  );
}
