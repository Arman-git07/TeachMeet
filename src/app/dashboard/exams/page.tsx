
'use client';
// This is a placeholder page for a general exams list, which may or may not be used
// depending on whether exams are managed globally or within each class.

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, PlusCircle, ArrowLeft, CheckCircle, Clock } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

const mockExams = [
    { id: 'midterm-alg', title: 'Algebra 101 - Midterm Exam', date: '2024-10-10', status: 'Upcoming' },
    { id: 'final-hist', title: 'World History - Final Exam', date: '2024-12-15', status: 'Upcoming' },
];

export default function DeprecatedExamsPage() {
    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">All Exams</h1>
                    <p className="text-muted-foreground">View all your scheduled exams across all classes.</p>
                </div>
            </div>

            <Card className="rounded-xl shadow-lg border-border/50">
                <CardHeader>
                    <CardTitle>Upcoming Exams</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {mockExams.map(exam => (
                            <div key={exam.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                                <div className="flex items-center gap-4">
                                    <FileText className="h-6 w-6 text-primary" />
                                    <div>
                                        <p className="font-semibold">{exam.title}</p>
                                        <p className="text-sm text-muted-foreground">Date: {exam.date}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{exam.status}</Badge>
                                    <Button asChild variant="outline" className="rounded-lg" size="sm">
                                        <Link href={`/dashboard/exam/${exam.id}`}>View Details</Link>
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
