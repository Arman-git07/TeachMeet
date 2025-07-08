
'use client';

// This is a placeholder page for taking a specific exam.
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Clock, FileQuestion } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

const mockExam = {
  title: 'Algebra 101 - Midterm Exam',
  duration: '90 minutes',
  questions: [
    { id: 'q1', text: 'What is the value of x if 2x + 5 = 15?', options: ['3', '5', '7', '10'] },
    { id: 'q2', text: 'Simplify the expression: (x^2 * x^5) / x^3', options: ['x^3', 'x^4', 'x^7', 'x^10'] },
  ]
};


export default function DeprecatedTakeExamPage() {
    const params = useParams();
    const examId = params.examId as string;

    return (
        <div className="space-y-8">
             <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">{mockExam.title}</h1>
                    <p className="text-muted-foreground flex items-center"><Clock className="mr-2 h-4 w-4"/> Duration: {mockExam.duration}</p>
                </div>
                 <Button asChild variant="outline" className="rounded-lg">
                    <Link href={`/dashboard/exams`}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Exams
                    </Link>
                </Button>
            </div>

            <Card className="rounded-xl shadow-lg border-border/50">
                <CardHeader>
                    <CardTitle>Questions</CardTitle>
                    <CardDescription>Select the best answer for each question.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {mockExam.questions.map((q, index) => (
                        <div key={q.id} className="p-4 border rounded-lg">
                            <p className="font-semibold mb-4"><FileQuestion className="inline-block mr-2 h-5 w-5"/>Question {index + 1}: {q.text}</p>
                            <RadioGroup>
                                {q.options.map(opt => (
                                    <div key={opt} className="flex items-center space-x-2">
                                        <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
                                        <Label htmlFor={`${q.id}-${opt}`}>{opt}</Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        </div>
                    ))}
                </CardContent>
                <CardFooter>
                    <Button className="w-full btn-gel rounded-lg">Submit Exam</Button>
                </CardFooter>
            </Card>
        </div>
    );
}

