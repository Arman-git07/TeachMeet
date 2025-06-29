
'use client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, PlusCircle, ShieldAlert, Clock, CheckCircle } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CreateExamDialogContent } from "@/components/exam/CreateExamDialog";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

const exams = [
  { id: "exm1", title: "Biology Midterm Exam", class: "Introduction to Biology", date: "2024-10-15", duration: "60 mins", status: "Upcoming" },
  { id: "exm2", title: "Algebra Quiz 1", class: "Advanced Mathematics", date: "2024-09-20", duration: "25 mins", status: "Graded" },
  { id: "exm3", title: "History Pop Quiz", class: "World History 101", date: "2024-09-10", duration: "10 mins", status: "Completed" },
];

export default function MyExamsPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Exams</h1>
          <p className="text-muted-foreground">View and manage your scheduled and past exams.</p>
        </div>
        <Dialog>
            <DialogTrigger asChild>
                <Button className="btn-gel rounded-lg">
                    <PlusCircle className="mr-2 h-5 w-5" /> Create New Exam
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl rounded-xl">
               <CreateExamDialogContent />
            </DialogContent>
        </Dialog>
      </div>

      {exams.length === 0 ? (
        <Card className="text-center py-12 rounded-xl shadow-lg border-border/50">
          <CardHeader>
            <ShieldAlert className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <CardTitle className="text-2xl">No Exams Yet</CardTitle>
            <CardDescription>You haven&apos;t created or been assigned any exams.</CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog>
                <DialogTrigger asChild>
                    <Button size="lg" className="btn-gel rounded-lg">
                        Create Your First Exam
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xl rounded-xl">
                    <CreateExamDialogContent />
                </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exams.map(exam => (
            <Card key={exam.id} className="flex flex-col rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 border-border/50">
              <CardHeader>
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <CardTitle className="text-xl truncate" title={exam.title}>{exam.title}</CardTitle>
                        <CardDescription>{exam.class}</CardDescription>
                    </div>
                     <Badge variant={exam.status === "Upcoming" ? "default" : "secondary"}>
                       {exam.status}
                     </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm flex-grow">
                <div className="flex items-center text-muted-foreground">
                  <FileText className="mr-2 h-4 w-4" /> {new Date(exam.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
                <div className="flex items-center text-muted-foreground">
                  <Clock className="mr-2 h-4 w-4" /> {exam.duration}
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4">
                {exam.status === "Upcoming" ? (
                   <Link href={`/dashboard/exam/${exam.id}`} passHref legacyBehavior>
                    <Button asChild className="w-full btn-gel rounded-lg">
                        <a>Begin Exam</a>
                    </Button>
                  </Link>
                ) : (
                  <Button variant="outline" className="w-full rounded-lg">
                    <CheckCircle className="mr-2 h-4 w-4" /> View Results
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
