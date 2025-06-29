
'use client';

import { use, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, MessageSquare, Users, BookOpen, BarChart3, Edit, Settings } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';

// Mock data for a class. In a real app, this would be fetched based on classId.
const mockClass = {
  id: "cls1",
  name: "Introduction to Biology",
  subject: "Science",
  teacher: "Dr. Alan Grant",
  bannerUrl: "https://placehold.co/1200x300.png",
  memberCount: 25,
  upcomingAssignment: "Essay on Photosynthesis",
  recentAnnouncement: "Welcome to the class! Please review the syllabus in the materials section."
};

const featureCards = [
    { title: "Assignments", description: "View and grade student work.", icon: FileText, href: "/assignments" },
    { title: "Class Chat", description: "Communicate with your students.", icon: MessageSquare, href: "/chat" },
    { title: "Manage Members", description: "Invite and manage class members.", icon: Users, href: "/manage-members" },
    { title: "Materials", description: "Share files, links, and resources.", icon: BookOpen, href: "/materials" },
    { title: "Analytics", description: "Track student progress.", icon: BarChart3, href: "#" }, // Placeholder link
    { title: "Edit Class", description: "Change class details.", icon: Edit, href: "/edit" },
];


export default function ClassHomePage({ params: paramsPromise }: { params: Promise<{ classId: string }> }) {
    const { classId } = use(paramsPromise);
    const { setHeaderContent } = useDynamicHeader();

    // Set the header content when the component mounts
    useEffect(() => {
        setHeaderContent(
            <div className="flex items-baseline gap-2">
                <h2 className="text-lg font-semibold text-foreground truncate">{mockClass.name}</h2>
                <p className="text-sm text-muted-foreground hidden sm:block">/ {mockClass.subject}</p>
            </div>
        );
        // Clear the header content when the component unmounts
        return () => setHeaderContent(null);
    }, [setHeaderContent, classId]);

    return (
        <div className="space-y-6">
            {/* Banner and Title Section */}
            <Card className="overflow-hidden rounded-xl shadow-lg border-border/50">
                <div className="relative w-full h-48 md:h-56 bg-muted">
                   <Image src={mockClass.bannerUrl} layout="fill" objectFit="cover" alt={`${mockClass.name} banner`} data-ai-hint="class banner" />
                   <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                   <div className="absolute bottom-4 left-6">
                        <h1 className="text-3xl md:text-4xl font-bold text-white shadow-md">{mockClass.name}</h1>
                        <p className="text-lg text-white/90 shadow-sm">Taught by {mockClass.teacher}</p>
                   </div>
                </div>
            </Card>

            {/* Quick Info Cards */}
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="rounded-xl shadow-md border-border/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Members</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{mockClass.memberCount}</div>
                        <p className="text-xs text-muted-foreground">students and teachers</p>
                    </CardContent>
                </Card>
                 <Card className="rounded-xl shadow-md border-border/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Upcoming Assignment</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold truncate" title={mockClass.upcomingAssignment}>{mockClass.upcomingAssignment}</div>
                        <p className="text-xs text-muted-foreground">Due September 15, 2024</p>
                    </CardContent>
                </Card>
                 <Card className="rounded-xl shadow-md border-border/50 md:col-span-2 lg:col-span-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Recent Announcement</CardTitle>
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-foreground truncate" title={mockClass.recentAnnouncement}>{mockClass.recentAnnouncement}</p>
                        <p className="text-xs text-muted-foreground">Posted 2 days ago</p>
                    </CardContent>
                </Card>
            </div>

            {/* Feature Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                 {featureCards.map((feature) => (
                    <Link key={feature.title} href={`/dashboard/class/${classId}${feature.href}`} passHref>
                        <Card className="group h-full flex flex-col rounded-xl shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-border/50 cursor-pointer">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <feature.icon className="h-8 w-8 text-primary transition-transform duration-300 group-hover:scale-110" />
                                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <p className="text-muted-foreground">{feature.description}</p>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}
