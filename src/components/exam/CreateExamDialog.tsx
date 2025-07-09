
'use client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Loader2, FileText, UploadCloud, PlusCircle, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// Define question structure
interface MCQuestion {
  id: string;
  text: string;
  options: { id: string; text: string }[];
  correctAnswerId: string;
}

export function CreateExamDialogContent() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<string>("Multiple Choice (Online)");
  const [dueDate, setDueDate] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  
  // New state for online questions
  const [questions, setQuestions] = useState<MCQuestion[]>([]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleAddQuestion = () => {
    const newQuestionId = `q-${Date.now()}`;
    const newOptions = [
        { id: `opt-1-${newQuestionId}`, text: "" },
        { id: `opt-2-${newQuestionId}`, text: "" },
        { id: `opt-3-${newQuestionId}`, text: "" },
        { id: `opt-4-${newQuestionId}`, text: "" },
    ];
    const newQuestion: MCQuestion = {
      id: newQuestionId,
      text: "",
      options: newOptions,
      correctAnswerId: newOptions[0].id,
    };
    setQuestions([...questions, newQuestion]);
  };

  const handleRemoveQuestion = (questionId: string) => {
    setQuestions(questions.filter(q => q.id !== questionId));
  };

  const handleQuestionTextChange = (questionId: string, text: string) => {
    setQuestions(questions.map(q => q.id === questionId ? { ...q, text } : q));
  };

  const handleOptionTextChange = (questionId: string, optionId: string, text: string) => {
    setQuestions(questions.map(q => 
      q.id === questionId ? { ...q, options: q.options.map(opt => opt.id === optionId ? { ...opt, text } : opt) } : q
    ));
  };

  const handleCorrectAnswerChange = (questionId: string, optionId: string) => {
    setQuestions(questions.map(q => q.id === questionId ? { ...q, correctAnswerId: optionId } : q));
  };

  const handleCreateExam = async () => {
    if (!title.trim()) {
      toast({ variant: "destructive", title: "Title Required", description: "Please enter a title for the assessment." });
      return;
    }
    if (!dueDate) {
        toast({ variant: "destructive", title: "Due Date Required", description: "Please select a due date." });
        return;
    }
    if (type.includes("Online") && questions.length === 0) {
        toast({ variant: "destructive", title: "Questions Required", description: "Please add at least one question for an online assessment." });
        return;
    }
    if (type === "Uploaded Paper" && !selectedFile) {
        toast({ variant: "destructive", title: "File Required", description: "Please upload a paper for this assessment type." });
        return;
    }
    setIsCreating(true);
    
    // Mock API call
    console.log("Creating exam:", { title, type, dueDate, description, questions, fileName: selectedFile?.name });
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast({
      title: "Assessment Created!",
      description: `The assessment "${title}" has been created.`,
    });
    
    setIsCreating(false);
    setTitle("");
    setDescription("");
    setType("Multiple Choice (Online)");
    setDueDate("");
    setSelectedFile(null);
    setQuestions([]);
  };

  // The online question editor component
  const OnlineQuestionEditor = () => (
    <div className="space-y-4">
        <Label>Online Questions</Label>
        <div className="border rounded-lg p-2 space-y-4 max-h-[300px]">
            <ScrollArea className="h-full pr-4">
                <div className="p-2 space-y-4">
                  {questions.length === 0 ? (
                      <div className="text-center text-muted-foreground py-4">
                          <p>No questions yet. Click "Add Question" to start.</p>
                      </div>
                  ) : (
                      questions.map((q, qIndex) => (
                          <div key={q.id} className="p-4 border rounded-lg bg-muted/50 relative">
                              <div className="flex justify-between items-center mb-2">
                                <Label htmlFor={`q-text-${q.id}`} className="font-semibold">Question {qIndex + 1}</Label>
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleRemoveQuestion(q.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              <Textarea
                                  id={`q-text-${q.id}`}
                                  placeholder="Type your question here..."
                                  value={q.text}
                                  onChange={(e) => handleQuestionTextChange(q.id, e.target.value)}
                                  className="mt-1"
                                  rows={2}
                              />
                              {type === "Multiple Choice (Online)" && (
                                  <div className="mt-4 space-y-2">
                                      <Label className="text-xs text-muted-foreground">Options (select the correct answer)</Label>
                                      <RadioGroup value={q.correctAnswerId} onValueChange={(value) => handleCorrectAnswerChange(q.id, value)}>
                                          {q.options.map((opt, optIndex) => (
                                              <div key={opt.id} className="flex items-center gap-2">
                                                  <RadioGroupItem value={opt.id} id={opt.id} />
                                                  <Input
                                                      placeholder={`Option ${optIndex + 1}`}
                                                      value={opt.text}
                                                      onChange={(e) => handleOptionTextChange(q.id, opt.id, e.target.value)}
                                                  />
                                              </div>
                                          ))}
                                      </RadioGroup>
                                  </div>
                              )}
                              {type === "Written Answer (Online)" && (
                                <div className="mt-2 p-3 text-center text-xs text-muted-foreground bg-background rounded-md border">
                                    Student will provide a written answer for this question.
                                </div>
                              )}
                          </div>
                      ))
                  )}
                </div>
            </ScrollArea>
        </div>
        <Button variant="outline" className="w-full" onClick={handleAddQuestion}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Question
        </Button>
    </div>
  );

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
            <OnlineQuestionEditor />
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
          disabled={!title.trim() || !dueDate || isCreating || (type === "Uploaded Paper" && !selectedFile) || (type.includes("Online") && questions.length === 0)}
        >
          {isCreating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
          {isCreating ? "Creating..." : "Create"}
        </Button>
      </DialogFooter>
    </>
  );
}
