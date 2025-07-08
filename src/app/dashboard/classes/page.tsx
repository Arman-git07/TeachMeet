
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, PlusCircle, ArrowRight, BookOpen, User } from "lucide-react";
import Link from "next/link";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { CreateClassDialogContent } from "@/components/class/CreateClassDialog";
import Image from "next/image";

const mockClasses = [
  { id: "math101", name: "Algebra 101", description: "Fundamentals of algebra and problem solving.", members: 25, subject: "Mathematics" },
  { id: "hist202", name: "World History: 1500-Present", description: "A survey of major global events.", members: 32, subject: "History" },
  { id: "lit301", name: "American Literature", description: "Exploring classic and contemporary American authors.", members: 18, subject: "Literature" },
];

export default function ClassesPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Classes</h1>
          <p className="text-muted-foreground">Manage your virtual classrooms.</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="btn-gel rounded-lg">
              <PlusCircle className="mr-2 h-5 w-5" /> Create New Class
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg rounded-xl">
            <CreateClassDialogContent />
          </DialogContent>
        </Dialog>
      </div>

      {mockClasses.length === 0 ? (
        <Card className="text-center py-12 rounded-xl shadow-lg border-border/50">
          <CardHeader>
            <Users className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <CardTitle className="text-2xl">No Classes Yet</CardTitle>
            <CardDescription>Get started by creating your first class.</CardDescription>
          </CardHeader>
          <CardContent>
             <Dialog>
              <DialogTrigger asChild>
                <Button size="lg" className="btn-gel rounded-lg">
                  <PlusCircle className="mr-2 h-5 w-5" /> Create New Class
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg rounded-xl">
                <CreateClassDialogContent />
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockClasses.map(cls => (
            <Card key={cls.id} className="flex flex-col rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 border-border/50">
              <div className="relative h-32 w-full">
                 <Image
                    src={`https://placehold.co/400x200.png?text=${cls.subject}`}
                    alt={cls.name}
                    layout="fill"
                    objectFit="cover"
                    className="rounded-t-xl opacity-70"
                    data-ai-hint="classroom study"
                 />
              </div>
              <CardHeader className="pb-3">
                <CardTitle className="text-xl truncate" title={cls.name}>{cls.name}</CardTitle>
                <CardDescription className="text-sm h-10 overflow-hidden">{cls.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm flex-grow">
                 <div className="flex items-center text-muted-foreground">
                  <BookOpen className="mr-2 h-4 w-4" /> {cls.subject}
                </div>
                <div className="flex items-center text-muted-foreground">
                  <User className="mr-2 h-4 w-4" /> {cls.members} Members
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4">
                 <Button asChild variant="default" className="w-full btn-gel rounded-lg">
                    <Link href={`/dashboard/class/${cls.id}`}>
                      Enter Class <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
