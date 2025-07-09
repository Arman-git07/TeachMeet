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
  const [type, setType] = useState<string>("Multiple Choice (Online)");
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
        description: "Please enter a title for the assessment.",
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
    if (type === "Uploaded Paper" && !selectedFile) {
        toast({
          variant: "destructive",
          title: "File Required",
          description: "Please upload a paper for this assessment type.",
        });
        return;
    }
    setIsCreating(true);
    
    // Mock API call
    console.log("Creating exam:", { title, type, dueDate, description, fileName: selectedFile?.name });
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast({
      title: "Assessment Created!",
      description: `The assessment "${title}" has been created. ${selectedFile ? `File "${selectedFile.name}" was uploaded.` : ''}`,
    });
    
    setIsCreating(false);
    setTitle("");
    setDescription("");
    setType("Multiple Choice (Online)");
    setDueDate("");
    setSelectedFile(null);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          <FileText className="mr-2 h-6 w-6 text-primary inline-block" />
          Create New Assessment
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
            <Select onValueChange={(value) => setType(value)} defaultValue={type} disabled={isCreating}>
                <SelectTrigger className="w-full mt-1 rounded-lg">
                    <SelectValue placeholder="Select an assessment type" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                    <SelectItem value="Multiple Choice (Online)" className="rounded-md">Multiple Choice (Online)</SelectItem>
                    <SelectItem value="Written Answer (Online)" className="rounded-md">Written Answer (Online)</SelectItem>
                    <SelectItem value="Uploaded Paper" className="rounded-md">Uploaded Paper</SelectItem>
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

        {/* Conditionally render file upload or online creation tools based on type */}
        {type === "Uploaded Paper" ? (
             <div>
                <Label htmlFor="examFile">Upload Paper</Label>
                <div className="mt-1 flex justify-center rounded-lg border border-dashed border-primary/50 bg-primary/5 px-6 py-10">
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
        ) : (
            <div>
                 <Label>Online Questions</Label>
                 <div className="mt-1 flex items-center justify-center rounded-lg border border-dashed border-border/70 px-6 py-10 text-center">
                    <p className="text-sm text-muted-foreground">Online question creation tools will be available here.</p>
                 </div>
            </div>
        )}

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
          disabled={!title.trim() || !dueDate || isCreating || (type === "Uploaded Paper" && !selectedFile)}
        >
          {isCreating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
          {isCreating ? "Creating..." : "Create"}
        </Button>
      </DialogFooter>
    </>
  );
}
