
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useParams, useRouter } from "next/navigation";
import React from "react";
import {
  Bell,
  BookOpen,
  ClipboardList,
  MessageSquare,
  Settings,
  Users,
  Edit,
  FileText
} from "lucide-react";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";

// Mock data, in a real app this would be fetched based on classId
const mockClassData = {
  name: "Algebra 101",
  description: "Fundamentals of algebra and problem solving.",
  teacher: {
    name: "Dr. Evelyn Reed",
    avatar: "https://placehold.co/100x100/223D4A/FFFFFF.png?text=ER",
  },
  announcements: [
    { id: 1, title: "Welcome to Algebra 101!", content: "Welcome everyone! Please review the syllabus in the materials section. Our first class is this Wednesday.", date: "2 days ago" },
    { id: 2, title: "Homework 1 Posted", content: "The first homework assignment is now available under 'Assignments'. It is due next Monday.", date: "1 day ago" },
  ],
};

const navigationItems = [
  { href: 'materials', icon: BookOpen, label: 'Materials' },
  { href: 'assignments', icon: ClipboardList, label: 'Assignments' },
  { href: 'chat', icon: MessageSquare, label: 'Class Chat' },
  { href: 'manage-members', icon: Users, label: 'Members' },
];

export default function ClassHomePage() {
  const params = useParams();
  const classId = params.classId as string;
  const router = useRouter();
  
  // In a real app, you would fetch class data using the classId
  const { name, description, teacher, announcements } = mockClassData;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Main Content Column */}
      <div className="lg:col-span-2 space-y-8">
        {/* Class Header */}
        <Card className="rounded-xl shadow-lg border-border/50">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-3xl font-bold">{name}</CardTitle>
                <CardDescription className="mt-1">{description}</CardDescription>
              </div>
              <Button asChild variant="outline" size="icon" className="rounded-lg flex-shrink-0">
                <Link href={`/dashboard/class/${classId}/edit`}>
                  <Settings className="h-5 w-5" />
                  <span className="sr-only">Class Settings</span>
                </Link>
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Announcements Section */}
        <Card className="rounded-xl shadow-lg border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center"><Bell className="mr-2 h-6 w-6 text-primary" />Announcements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {announcements.map((ann, index) => (
              <React.Fragment key={ann.id}>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-lg">{ann.title}</h3>
                    <p className="text-xs text-muted-foreground">{ann.date}</p>
                  </div>
                  <p className="text-muted-foreground mt-1">{ann.content}</p>
                </div>
                {index < announcements.length - 1 && <Separator />}
              </React.Fragment>
            ))}
          </CardContent>
          <CardFooter>
             <Button variant="outline" className="w-full rounded-lg">
              <Edit className="mr-2 h-4 w-4" /> Post New Announcement
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Right Sidebar Column */}
      <div className="space-y-6">
        {/* Teacher Info */}
        <Card className="rounded-xl shadow-lg border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Instructor</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={teacher.avatar} alt={teacher.name} data-ai-hint="teacher avatar"/>
              <AvatarFallback>{teacher.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{teacher.name}</p>
              <p className="text-sm text-muted-foreground">Lead Instructor</p>
            </div>
          </CardContent>
        </Card>
        
        {/* Navigation */}
        <Card className="rounded-xl shadow-lg border-border/50">
           <CardHeader>
            <CardTitle className="text-lg">Classroom Hub</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {navigationItems.map(item => (
              <Button key={item.href} asChild variant="ghost" className="w-full justify-start text-base py-3 px-4 rounded-lg">
                <Link href={`/dashboard/class/${classId}/${item.href}`}>
                  <item.icon className="mr-3 h-5 w-5 text-primary" />
                  {item.label}
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
