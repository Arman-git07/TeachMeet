
'use client';

import { use, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, HelpCircle, ArrowLeft, ArrowRight, Flag, FileText } from "lucide-react";
import Link from "next/link";
import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

// Mock data for an exam.
const mockExam = {
  id: "exm1",
  title: "Biology Midterm Exam",
  class: "Introduction to Biology",
  durationMinutes: 60,
  questions: [
    {
      id: "q1",
      text: "What is the powerhouse of the cell?",
      options: ["Nucleus", "Ribosome", "Mitochondrion", "Chloroplast"],
      correctAnswer: "Mitochondrion",
    },
    {
      id: "q2",
      text: "Which of these is NOT a primary component of DNA?",
      options: ["Deoxyribose Sugar", "Phosphate Group", "Nitrogenous Base", "Amino Acid"],
      correctAnswer: "Amino Acid",
    },
    {
      id: "q3",
      text: "What is the process by which plants make their own food?",
      options: ["Respiration", "Photosynthesis", "Transpiration", "Fermentation"],
      correctAnswer: "Photosynthesis",
    },
  ],
};


export default function TakeExamPage({ params: paramsPromise }: { params: Promise<{ examId: string }> }) {
    const { examId } = use(paramsPromise);
    const { setHeaderContent } = useDynamicHeader();
    
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [timeLeft, setTimeLeft] = useState(mockExam.durationMinutes * 60);
    const currentQuestion = mockExam.questions[currentQuestionIndex];

    useEffect(() => {
        setHeaderContent(
             <div className="flex items-baseline gap-2 w-full justify-between">
                <h2 className="text-lg font-semibold text-foreground truncate">{mockExam.title}</h2>
                <div className="flex items-center gap-2 text-lg font-mono bg-destructive text-destructive-foreground px-3 py-1 rounded-lg">
                    <Clock className="h-5 w-5" />
                    <span>{Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{ (timeLeft % 60).toString().padStart(2, '0') }</span>
                </div>
            </div>
        );
         // Timer logic
        const timer = setInterval(() => {
            setTimeLeft(prevTime => (prevTime > 0 ? prevTime - 1 : 0));
        }, 1000);

        return () => {
          clearInterval(timer);
          setHeaderContent(null);
        };
    }, [setHeaderContent, examId, timeLeft]);

    const handleNextQuestion = () => {
        if (currentQuestionIndex < mockExam.questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        }
    };
    
    const handlePreviousQuestion = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev - 1);
        }
    };

    return (
        <div className="flex flex-col h-full p-4 items-center">
            <Card className="w-full max-w-3xl rounded-xl shadow-xl flex-grow flex flex-col">
                <CardHeader className="border-b">
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="text-xl">Question {currentQuestionIndex + 1} of {mockExam.questions.length}</CardTitle>
                            <CardDescription>Select the best answer.</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" className="rounded-lg">
                            <Flag className="mr-2 h-4 w-4" />
                            Report Question
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="flex-grow py-6">
                    <p className="text-lg font-medium mb-6">{currentQuestion.text}</p>
                    <RadioGroup defaultValue="">
                        {currentQuestion.options.map((option, index) => (
                           <Label key={index} htmlFor={`option-${index}`} className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-muted has-[:checked]:bg-primary/10 has-[:checked]:border-primary transition-colors">
                                <RadioGroupItem value={option} id={`option-${index}`} className="h-5 w-5" />
                                <span className="ml-3 text-base">{option}</span>
                            </Label>
                        ))}
                    </RadioGroup>
                </CardContent>
                <CardFooter className="border-t pt-4 flex justify-between">
                    <Button variant="outline" className="rounded-lg" onClick={handlePreviousQuestion} disabled={currentQuestionIndex === 0}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Previous
                    </Button>
                     {currentQuestionIndex === mockExam.questions.length - 1 ? (
                         <Button className="btn-gel rounded-lg">
                            <FileText className="mr-2 h-4 w-4" />
                            Submit Exam
                        </Button>
                     ) : (
                        <Button className="rounded-lg" onClick={handleNextQuestion}>
                            Next
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                     )}
                </CardFooter>
            </Card>
        </div>
    );
}
