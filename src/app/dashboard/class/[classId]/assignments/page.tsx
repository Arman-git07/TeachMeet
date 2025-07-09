
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, PlusCircle, ArrowLeft, CheckCircle, Clock } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

const mockAssignments = [
    { id: 'hw1', title: 'Homework 1: Solving Linear Equations', dueDate: '2024-09-15', status: 'Graded', score: '95/100' },
    { id: 'hw2', title: 'Homework 2: Graphing Functions', dueDate: '2024-09-22', status: 'Submitted' },
    { id: 'project1', title: 'Project 1: Real-world Applications', dueDate: '2024-10-01', status: 'Upcoming' },
];

export default function ClassAssignmentsPage() {
    const params = useParams();
    const classId = params.classId as string;

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Assignments</h1>
                    <p className="text-muted-foreground">View and submit your homework and projects for this class.</p>
                </div>
                <Button asChild variant="outline" className="rounded-lg">
                    <Link href={`/dashboard/class/${classId}`}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Class
                    </Link>
                </Button>
            </div>

            <Card className="rounded-xl shadow-lg border-border/50">
                <CardHeader>
                    <CardTitle>Assignment List</CardTitle>
                    <CardDescription>All homework and projects for this class are listed below.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {mockAssignments.map(assignment => (
                            <div key={assignment.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                                <div className="flex items-center gap-4">
                                    <FileText className="h-6 w-6 text-primary" />
                                    <div>
                                        <p className="font-semibold">{assignment.title}</p>
                                        <p className="text-sm text-muted-foreground">Due: {assignment.dueDate}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    {assignment.status === 'Graded' && <Badge variant="default">{assignment.score}</Badge>}
                                    {assignment.status === 'Submitted' && <Badge variant="secondary"><CheckCircle className="h-3 w-3 mr-1" />{assignment.status}</Badge>}
                                    {assignment.status === 'Upcoming' && <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{assignment.status}</Badge>}
                                    <Button variant="outline" className="rounded-lg" size="sm">View</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
                 <CardFooter>
                    <Button className="w-full btn-gel rounded-lg">
                        <PlusCircle className="mr-2 h-4 w-4" /> Submit New Assignment
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
