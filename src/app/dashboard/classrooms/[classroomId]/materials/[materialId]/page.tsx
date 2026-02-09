'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, FileText, Globe, Download, ExternalLink, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

export default function MaterialViewerPage() {
    const { classroomId, materialId } = useParams() as { classroomId: string; materialId: string };
    const router = useRouter();
    const { toast } = useToast();
    
    const [material, setMaterial] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (materialId === 'demo-physics') {
                setMaterial({
                    name: "Demo: Physics Lecture Notes",
                    url: "https://www.africau.edu/images/default/sample.pdf",
                    type: 'file',
                    uploaderName: 'Admin'
                });
                setIsLoading(false);
                return;
            }
            if (materialId === 'demo-reading') {
                setMaterial({
                    name: "Demo: Recommended Reading",
                    url: "https://wikipedia.org",
                    type: 'link',
                    uploaderName: 'Admin'
                });
                setIsLoading(false);
                return;
            }

            try {
                const matRef = doc(db, 'classrooms', classroomId, 'materials', materialId);
                const snap = await getDoc(matRef);
                if (snap.exists()) {
                    setMaterial(snap.data());
                } else {
                    toast({ variant: 'destructive', title: "Not Found", description: "Material could not be found." });
                    router.back();
                }
            } catch (error) {
                console.error("Fetch material failed:", error);
                toast({ variant: 'destructive', title: "Error", description: "Failed to load material." });
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [classroomId, materialId, toast, router]);

    if (isLoading) {
        return (
            <div className="container mx-auto p-8 space-y-4">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-[70vh] w-full rounded-2xl" />
            </div>
        );
    }

    if (!material) return null;

    const isPdf = material.url.toLowerCase().split('?')[0].endsWith('.pdf') || material.url.includes('sample.pdf');
    const isImage = material.url.match(/\.(jpeg|jpg|gif|png)$/) != null;

    return (
        <div className="container mx-auto p-4 md:p-8 flex flex-col h-full bg-background overflow-hidden">
            <header className="flex items-center justify-between mb-6 shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight truncate max-w-[300px] sm:max-w-md">{material.name}</h1>
                        <p className="text-sm text-muted-foreground">Added by {material.uploaderName}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {material.type === 'file' && (
                        <Button asChild variant="outline" size="sm" className="rounded-lg">
                            <a href={material.url} download={material.name}>
                                <Download className="mr-2 h-4 w-4"/> Download
                            </a>
                        </Button>
                    )}
                    {material.type === 'link' && (
                        <Button asChild size="sm" className="btn-gel rounded-lg">
                            <a href={material.url} target="_blank" rel="noreferrer">
                                <ExternalLink className="mr-2 h-4 w-4"/> Visit Site
                            </a>
                        </Button>
                    )}
                </div>
            </header>

            <main className="flex-1 min-h-0 overflow-hidden">
                <Card className="h-full flex flex-col overflow-hidden shadow-lg border-border/50">
                    <CardHeader className="py-3 border-b bg-muted/20 flex flex-row items-center justify-between shrink-0">
                        <CardTitle className="text-sm flex items-center gap-2">
                            {material.type === 'file' ? <FileText className="h-4 w-4 text-primary" /> : <Globe className="h-4 w-4 text-accent" />}
                            Class Material posted by {material.uploaderName}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 overflow-auto bg-white">
                        {material.type === 'file' ? (
                            isPdf ? (
                                <iframe 
                                    src={`${material.url}#toolbar=0`} 
                                    className="w-full h-full border-none" 
                                    title={material.name}
                                />
                            ) : isImage ? (
                                <div className="p-4 flex items-center justify-center min-h-full">
                                    <img src={material.url} alt={material.name} className="max-w-full h-auto rounded-lg shadow-sm border" />
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
                                    <FileText className="h-16 w-16 text-muted-foreground opacity-20" />
                                    <p className="text-muted-foreground">This file type cannot be previewed directly.</p>
                                    <Button asChild className="btn-gel">
                                        <a href={material.url} download>Download to View</a>
                                    </Button>
                                </div>
                            )
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6">
                                <div className="h-20 w-20 rounded-full bg-accent/10 flex items-center justify-center">
                                    <Globe className="h-10 w-10 text-accent" />
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-xl font-bold">External Resource</h2>
                                    <p className="text-muted-foreground max-w-sm mx-auto">
                                        This material is an external link. For security reasons, we recommend opening it in a new tab.
                                    </p>
                                </div>
                                <Button asChild size="lg" className="btn-gel rounded-xl px-8 h-14 text-lg shadow-xl">
                                    <a href={material.url} target="_blank" rel="noreferrer">
                                        Open "{material.name}"
                                        <ExternalLink className="ml-2 h-5 w-5" />
                                    </a>
                                </Button>
                                <p className="text-xs text-muted-foreground">URL: {material.url}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}