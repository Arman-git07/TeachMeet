
// src/app/dashboard/class/[classId]/materials/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ArrowLeft, FileText as FileTextIcon, Link as LinkIcon, Video, Info, FolderOpen, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase'; // Import db
import { collection, query, onSnapshot } from 'firebase/firestore'; // Firestore imports
import { useAuth } from '@/hooks/useAuth';

interface Material {
  id: string;
  title: string;
  type: 'link' | 'file' | 'video';
  url?: string;
  fileName?: string;
  description?: string;
  filePath?: string; // Path in Firebase Storage
}

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
  const { loading: authLoading } = useAuth();

  const classId = params.classId as string;
  const className = searchParams.get('name') || "Class";

  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return; // Wait for auth state to be determined
    if (!classId || !db) return;
    setLoading(true);
    const materialsColRef = collection(db, "classrooms", classId, "materials");
    // Add orderBy if you have a timestamp field for materials
    const q = query(materialsColRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMaterials: Material[] = [];
      snapshot.forEach(doc => {
        fetchedMaterials.push({ id: doc.id, ...doc.data() } as Material);
      });
      
      // Prepend the dynamic "Join Live Class" link
      const liveClassMaterial: Material = {
        id: `mat_live_${classId}`, 
        title: "Join Live Class Session!", 
        type: "link", 
        url: `/dashboard/meeting/${classId}/wait?topic=${encodeURIComponent(className)}`, 
        description: "Click here to join the ongoing or upcoming class meeting for this class."
      };
      setMaterials([liveClassMaterial, ...fetchedMaterials]);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching materials:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load materials." });
      setLoading(false);
    });
    return () => unsubscribe();
  }, [classId, className, toast, authLoading]);

  const handleMaterialAction = (material: Material) => {
    if (material.url) {
      if (material.url.startsWith('/')) { 
        router.push(material.url);
      } else { 
        window.open(material.url, '_blank', 'noopener,noreferrer');
      }
    } else if (material.type === 'file' && material.fileName) { // For locally uploaded files, url might be the downloadURL from storage
        toast({
            title: "File Access",
            description: `File: ${material.fileName}. In a real app, this would trigger a download or open in a new tab if a direct URL exists.`,
        });
        // If material.filePath exists and you want to construct a download:
        // const storageFileRef = storageRef(storage, material.filePath);
        // getDownloadURL(storageFileRef).then(url => window.open(url, '_blank')).catch(...);
    } else {
      toast({ variant: "destructive", title: "Action Not Available", description: "No URL or file associated." });
    }
  };

  if (loading || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
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
                  {material.description ? ( <p className="line-clamp-2">{material.description}</p> ) : ( <p className="italic">No description provided.</p> )}
                  {material.fileName && material.type === 'file' && ( <p className="text-xs mt-1">File: <span className="font-medium text-accent">{material.fileName}</span></p> )}
                </CardContent>
                <CardFooter className="border-t pt-3">
                   <Button 
                    onClick={() => handleMaterialAction(material)} 
                    className="w-full rounded-lg text-sm btn-gel"
                    disabled={!material.url && !(material.type === 'file' && material.fileName)}
                    >
                    {material.type === 'link' || material.type === 'video' ? 'Open Link' : (material.type === 'file' ? 'View/Download File' : 'Access Material')}
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
