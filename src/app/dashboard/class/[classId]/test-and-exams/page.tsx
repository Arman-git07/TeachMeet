
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, PlusCircle, ArrowLeft, CheckCircle, Clock } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const mockTests = [
    { id: 'midterm', title: 'Midterm Exam', dueDate: '2024-10-10', status: 'Upcoming', type: 'Exam' },
    { id: 'quiz1', title: 'Chapter 3 Quiz', dueDate: '2024-09-28', status: 'Graded', score: '88/100', type: 'Quiz' },
    { id: 'final', title: 'Final Exam', dueDate: '2024-12-18', status: 'Upcoming', type: 'Exam' },
];

const mockTeacherId = "teacher-evelyn-reed-uid";

export default function ClassTestAndExamsPage() {
    const params = useParams();
    const classId = params.classId as string;
    const { user: currentUser } = useAuth();

    const isHost = currentUser?.uid === mockTeacherId;

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Test & Exams</h1>
                    <p className="text-muted-foreground">Manage and review tests and exams for this class.</p>
                </div>
                <Button asChild variant="outline" className="rounded-lg">
                    <Link href={`/dashboard/class/${classId}`}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Class
                    </Link>
                </Button>
            </div>

            <Card className="rounded-xl shadow-lg border-border/50">
                <CardHeader>
                    <CardTitle>Test & Exam List</CardTitle>
                    <CardDescription>All tests and exams for this class are listed below.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {mockTests.map(test => (
                            <div key={test.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                                <div className="flex items-center gap-4">
                                    <FileText className="h-6 w-6 text-primary" />
                                    <div>
                                        <p className="font-semibold">{test.title}</p>
                                        <p className="text-sm text-muted-foreground">Due: {test.dueDate}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Badge variant="secondary" className="rounded-md">{test.type}</Badge>
                                    {test.status === 'Graded' && <Badge variant="default">{test.score}</Badge>}
                                    {test.status === 'Upcoming' && <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{test.status}</Badge>}
                                    <Button variant="outline" className="rounded-lg" size="sm">View</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
                 {isHost && (
                    <CardFooter>
                        <Button className="w-full btn-gel rounded-lg">
                            <PlusCircle className="mr-2 h-4 w-4" /> Create New Test / Exam
                        </Button>
                    </CardFooter>
                 )}
            </Card>
        </div>
    );
}
