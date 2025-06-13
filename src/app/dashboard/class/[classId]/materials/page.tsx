
// src/app/dashboard/class/[classId]/materials/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ArrowLeft, FileText as FileTextIcon, Link as LinkIcon, Video, Info, FolderOpen } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

interface Material {
  id: string;
  title: string;
  type: 'link' | 'file' | 'video';
  url?: string;
  fileName?: string;
  description?: string;
}

// Mock function to get materials for a class
// In a real app, this would fetch from a database (e.g., Firestore)
const getMockMaterialsForClass = (classId: string, className?: string | null): Material[] => {
  const defaultClassName = className || `Class ${classId}`;
  return [
    { id: `mat_live_${classId}`, title: "Join Live Class Session!", type: "link", url: `/dashboard/meeting/${classId}/wait?topic=${encodeURIComponent(defaultClassName)}`, description: "Click here to join the ongoing or upcoming class meeting for this class." },
    { id: `mat1_${classId}`, title: "Course Syllabus", type: "file", fileName: `syllabus_${classId}.pdf`, description: "Detailed course outline, grading policy, and schedule for the entire semester." },
    { id: `mat2_${classId}`, title: "Recommended Reading List", type: "link", url: "#", description: "A curated list of external articles, books, and resources to supplement your learning." },
    { id: `mat3_${classId}`, title: "Introductory Video Lecture Series", type: "video", url: "#", description: "A collection of pre-recorded lectures covering the fundamental concepts of this course." },
    { id: `mat4_${classId}`, title: "Python Setup Guide (for labs)", type: "file", fileName: `python_setup_guide_${classId}.md`, description: "Step-by-step instructions for setting up your Python development environment for lab exercises." },
    { id: `mat5_${classId}`, title: "Week 1 Lecture Slides", type: "file", fileName: `week1_slides_${classId}.pptx`, description: "Presentation slides for the first week's topics." },
    { id: `mat6_${classId}`, title: "External Resource: Khan Academy Math", type: "link", url: "https://www.khanacademy.org/math", description: "Helpful math resources for foundational concepts." },
    { id: `mat7_${classId}`, title: "Project Guidelines Document", type: "file", fileName: `project_guidelines_${classId}.pdf`, description: "Comprehensive guidelines for the final project, including rubric and submission details." },
    { id: `mat8_${classId}`, title: "Supplementary Video: The Double Slit Experiment", type: "video", url: "#", description: "An engaging video explaining the double-slit experiment in quantum physics." },
  ];
};

const MaterialTypeIcon = ({ type }: { type: Material['type'] }) => {
  if (type === 'link') return <LinkIcon className="mr-3 h-6 w-6 text-primary flex-shrink-0" />;
  if (type === 'file') return <FileTextIcon className="mr-3 h-6 w-6 text-primary flex-shrink-0" />;
  if (type === 'video') return <Video className="mr-3 h-6 w-6 text-primary flex-shrink-0" />;
  return <Info className="mr-3 h-6 w-6 text-primary flex-shrink-0" />;
};

export default function ClassMaterialsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const classId = params.classId as string;
  const className = searchParams.get('name') || "Class";

  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (classId) {
      setLoading(true);
      // Simulate fetching materials
      setTimeout(() => {
        const fetchedMaterials = getMockMaterialsForClass(classId, className);
        setMaterials(fetchedMaterials);
        setLoading(false);
      }, 500);
    }
  }, [classId, className]);

  const handleMaterialAction = (material: Material) => {
    if (material.url) {
      if (material.url.startsWith('/')) { // Internal link
        router.push(material.url);
      } else { // External link
        window.open(material.url, '_blank', 'noopener,noreferrer');
      }
    } else if (material.fileName) {
      toast({
        title: "Download (Mock)",
        description: `Simulating download for: ${material.fileName}`,
      });
      // In a real app: window.location.href = actualDownloadLink;
    } else {
      toast({
        variant: "destructive",
        title: "Action Not Available",
        description: "No URL or file associated with this material.",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4"></div>
        <p className="text-muted-foreground">Loading materials for {className}...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
           <FileTextIcon className="h-8 w-8 text-primary" />
           <div>
            <h1 className="text-2xl font-bold text-foreground">All Materials for {className}</h1>
            <p className="text-sm text-muted-foreground">Class ID: {classId}</p>
           </div>
        </div>
        <Link href={`/dashboard/class/${classId}?name=${encodeURIComponent(className)}`} passHref legacyBehavior>
          <Button variant="outline" className="rounded-lg">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Class Details
          </Button>
        </Link>
      </div>

      {materials.length === 0 ? (
        <Card className="flex-grow flex flex-col items-center justify-center text-center py-12 rounded-xl shadow-lg border-border/50">
          <FolderOpen className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <CardTitle className="text-xl">No Materials Found</CardTitle>
          <CardDescription>There are no materials uploaded for this class yet.</CardDescription>
        </Card>
      ) : (
        <ScrollArea className="flex-grow -mx-4">
          <div className="space-y-3 px-4 pb-4">
            {materials.map((material) => (
              <Card key={material.id} className="rounded-xl shadow-md border-border/50 hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center">
                    <MaterialTypeIcon type={material.type} />
                    <CardTitle className="text-lg truncate flex-grow" title={material.title}>{material.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground pb-4 pt-0">
                  {material.description ? (
                     <p className="line-clamp-2">{material.description}</p>
                  ) : (
                    <p className="italic">No description provided.</p>
                  )}
                  {material.fileName && material.type === 'file' && (
                    <p className="text-xs mt-1">File: <span className="font-medium text-accent">{material.fileName}</span></p>
                  )}
                </CardContent>
                <CardFooter className="border-t pt-3">
                   <Button 
                    onClick={() => handleMaterialAction(material)} 
                    className="w-full rounded-lg text-sm btn-gel"
                    disabled={!material.url && !material.fileName}
                    >
                    {material.type === 'link' || material.type === 'video' ? 'Open Link' : 'Download File'}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
       <footer className="flex-none py-2 text-center text-xs text-muted-foreground border-t bg-background">
        Browse and access all learning materials shared by your teacher.
      </footer>
    </div>
  );
}
