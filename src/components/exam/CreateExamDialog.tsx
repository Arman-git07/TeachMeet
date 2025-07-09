
'use client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Loader2, FileText, UploadCloud } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CreateExamDialogContent() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"Quiz" | "Test" | "Exam" | "Multiple Choice Questions">("Quiz");
  const [dueDate, setDueDate] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };


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
    console.log("Creating exam:", { title, type, dueDate, description, fileName: selectedFile?.name });
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast({
      title: "Test/Exam Created!",
      description: `The ${type.toLowerCase()} "${title}" has been created. ${selectedFile ? `File "${selectedFile.name}" was uploaded.` : ''}`,
    });
    
    setIsCreating(false);
    setTitle("");
    setDescription("");
    setDueDate("");
    setSelectedFile(null);
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

        <div>
            <Label htmlFor="examFile">Upload Paper (Optional)</Label>
            <div className="mt-1 flex justify-center rounded-lg border border-dashed border-border/70 px-6 py-10">
                <div className="text-center">
                    <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
                    <div className="mt-4 flex text-sm leading-6 text-muted-foreground">
                        <Label
                            htmlFor="examFile"
                            className="relative cursor-pointer rounded-md bg-background font-semibold text-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 hover:text-primary/80"
                        >
                            <span>{selectedFile ? 'Change file' : 'Upload a file'}</span>
                            <Input id="examFile" name="examFile" type="file" className="sr-only" onChange={handleFileChange} disabled={isCreating} accept=".pdf,.doc,.docx,.txt" />
                        </Label>
                        {!selectedFile && <p className="pl-1">or drag and drop</p>}
                    </div>
                    {selectedFile ? (
                        <p className="text-sm mt-2 font-medium text-foreground">{selectedFile.name}</p>
                    ) : (
                        <p className="text-xs leading-5">PDF, DOC, DOCX, TXT up to 10MB</p>
                    )}
                </div>
            </div>
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
