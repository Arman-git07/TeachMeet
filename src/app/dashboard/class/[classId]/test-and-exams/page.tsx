
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, PlusCircle, ArrowLeft, CheckCircle, Clock, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { CreateExamDialogContent } from "@/components/exam/CreateExamDialog";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot, query, orderBy } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";

interface Test {
    id: string;
    title: string;
    dueDate: string;
    type: string;
    status: 'Upcoming' | 'Graded' | 'In Progress';
    score?: string;
}

export default function ClassTestAndExamsPage() {
    const params = useParams();
    const classId = params.classId as string;
    const { user: currentUser } = useAuth();

    const [tests, setTests] = useState<Test[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isHost, setIsHost] = useState(false);
    
    useEffect(() => {
        if (!classId) return;

        // Check host status
        const classDocRef = doc(db, "classes", classId);
        const classUnsub = onSnapshot(classDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setIsHost(docSnap.data().creatorId === currentUser?.uid);
            }
        });

        // Fetch tests
        const testsQuery = query(collection(db, "classes", classId, "tests"), orderBy("dueDate", "desc"));
        const testsUnsub = onSnapshot(testsQuery, (snapshot) => {
            const fetchedTests: Test[] = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                // Here you would add logic to determine the status and score based on student submissions
                fetchedTests.push({
                    id: doc.id,
                    ...data,
                    status: 'Upcoming', // Placeholder status logic
                } as Test);
            });
            setTests(fetchedTests);
            setIsLoading(false);
        });

        return () => {
            classUnsub();
            testsUnsub();
        };
    }, [classId, currentUser?.uid]);

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Test & Exams</h1>
                    <p className="text-muted-foreground">Manage and review tests and exams for this class.</p>
                </div>
                <Button asChild variant="outline" className="rounded-lg">
                    <Link href={`/dashboard/class/${classId}`}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Class</Link>
                </Button>
            </div>

            <Card className="rounded-xl shadow-lg border-border/50">
                <CardHeader>
                    <CardTitle>Test & Exam List</CardTitle>
                    <CardDescription>All tests and exams for this class are listed below.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-4">
                            <Skeleton className="h-16 w-full rounded-lg" />
                            <Skeleton className="h-16 w-full rounded-lg" />
                        </div>
                    ) : tests.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                            <FileText className="mx-auto h-12 w-12 mb-2" />
                            <p>No tests or exams have been created yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {tests.map(test => (
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
                    )}
                </CardContent>
                {isHost && (
                    <CardFooter>
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button className="w-full btn-gel rounded-lg">
                                    <PlusCircle className="mr-2 h-4 w-4" /> Create New Test / Exam
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-lg rounded-xl">
                                <CreateExamDialogContent />
                            </DialogContent>
                        </Dialog>
                    </CardFooter>
                )}
            </Card>
        </div>
    );
}
