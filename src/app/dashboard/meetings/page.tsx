
'use client'; 

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Video, Users, Clock, PlusCircle, Trash2, Edit } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const meetings = [
  { id: "1", title: "Project Alpha Sync", date: "2024-08-15", time: "10:00 AM", status: "Upcoming", participants: 5, type: "Team Meeting" },
  { id: "2", title: "Client Demo Q3", date: "2024-08-10", time: "02:30 PM", status: "Completed", participants: 3, type: "Presentation" },
  { id: "3", title: "Weekly Study Group", date: "2024-08-08", time: "07:00 PM", status: "Completed", participants: 8, type: "Study Session" },
  { id: "4", title: "Marketing Brainstorm", date: "2024-08-20", time: "11:00 AM", status: "Upcoming", participants: 12, type: "Collaboration" },
];

export default function MyMeetingsPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Meetings</h1>
          <p className="text-muted-foreground">View and manage your scheduled and past meetings.</p>
        </div>
        <Link href="/dashboard/start-meeting" passHref legacyBehavior>
          <Button className="btn-gel rounded-lg">
            <PlusCircle className="mr-2 h-5 w-5" /> Schedule New Meeting
          </Button>
        </Link>
      </div>

      {meetings.length === 0 ? (
        <Card className="text-center py-12 rounded-xl shadow-lg border-border/50">
          <CardHeader>
            <CalendarDays className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <CardTitle className="text-2xl">No Meetings Yet</CardTitle>
            <CardDescription>You haven&apos;t scheduled or joined any meetings.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/start-meeting" passHref legacyBehavior>
              <Button size="lg" className="btn-gel rounded-lg">
                Schedule Your First Meeting
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {meetings.map(meeting => (
            <Card key={meeting.id} className="flex flex-col rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 border-border/50">
              <div className="relative h-32 w-full">
                 <Image
                    src={`https://placehold.co/400x200.png/223D4A/FFFFFF?text=${meeting.type.replace(' ', '+')}`}
                    alt={meeting.title}
                    layout="fill"
                    objectFit="cover"
                    className="rounded-t-xl opacity-70"
                    data-ai-hint="meeting abstract"
                 />
                 <div className="absolute top-2 right-2">
                    <Badge variant={meeting.status === "Upcoming" ? "default" : "secondary"} className="bg-primary/80 text-primary-foreground backdrop-blur-sm rounded-full"> {/* Ensure badge is also rounded */}
                        {meeting.status}
                    </Badge>
                 </div>
              </div>
              <CardHeader className="pb-3">
                <CardTitle className="text-xl truncate" title={meeting.title}>{meeting.title}</CardTitle>
                <CardDescription className="text-sm">{meeting.type}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm flex-grow">
                <div className="flex items-center text-muted-foreground">
                  <CalendarDays className="mr-2 h-4 w-4" /> {new Date(meeting.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
                <div className="flex items-center text-muted-foreground">
                  <Clock className="mr-2 h-4 w-4" /> {meeting.time}
                </div>
                <div className="flex items-center text-muted-foreground">
                  <Users className="mr-2 h-4 w-4" /> {meeting.participants} Participants
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4 grid grid-cols-2 gap-2">
                {meeting.status === "Upcoming" ? (
                  <Button variant="default" className="w-full btn-gel rounded-lg"> {/* Changed to rounded-lg */}
                    <Video className="mr-2 h-4 w-4" /> Join
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full rounded-lg" disabled> {/* Changed to rounded-lg */}
                    Completed
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full rounded-lg">More Options</Button> {/* Changed to rounded-lg */}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-lg">
                    <DropdownMenuItem className="rounded-md"><Edit className="mr-2 h-4 w-4" /> Edit Details</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive rounded-md">
                      <Trash2 className="mr-2 h-4 w-4" /> Cancel Meeting
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
