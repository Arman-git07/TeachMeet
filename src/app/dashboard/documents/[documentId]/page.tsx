'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
    ArrowLeft, 
    FileText, 
    Globe, 
    Download, 
    Loader2, 
    Lock, 
    Cloud, 
    MoreVertical 
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function DocumentViewerPage() {
    const { documentId } = useParams() as { documentId: string };
    const router = useRouter();
    const { toast } = useToast();
    const { user } = useAuth();
    
    const [document, setDocument] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            // Handle Demo Documents
            if (documentId === 'demo-private-1') {
                setDocument({
                    name: '[DEMO] Personal Lesson Plan Draft - Math.pdf',
                    downloadURL: 'https://www.africau.edu/images/default/sample.pdf',
                    isPrivate: true,
                    uploaderId: 'demo-system',
                    size: '1.2MB'
                });
                setIsLoading(false);
                return;
            }
            if (documentId === 'demo-public-1') {
                setDocument({
                    name: '[DEMO] Physics 101 Classroom Syllabus.pdf',
                    downloadURL: 'https://www.africau.edu/images/default/sample.pdf',
                    isPrivate: false,
                    uploaderId: 'demo-system',
                    size: '0.8MB'
                });
                setIsLoading(false);
                return;
            }

            try {
                const docRef = doc(db, 'documents', documentId);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();
                    // Access check for private documents
                    if (data.isPrivate && data.uploaderId !== user?.uid) {
                        toast({ variant: 'destructive', title: "Access Denied", description: "This is a private document." });
                        router.back();
                        return;
                    }
                    setDocument(data);
                } else {
                    toast({ variant: 'destructive', title: "Not Found", description: "Document could not be found." });
                    router.back();
                }
            } catch (error) {
                console.error("Fetch document failed:", error);
                toast({ variant: 'destructive', title: "Error", description: "Failed to load document." });
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [documentId, toast, router, user]);

    const handleDirectDownload = useCallback(async () => {
        if (!document?.downloadURL) return;
        setIsDownloading(true);
        try {
            const response = await fetch(document.downloadURL);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            
            const link = window.document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', document.name || 'document');
            window.document.body.appendChild(link);
            link.click();
            
            window.document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
            
            toast({ title: "Download Started", description: "Your file is being saved to your device." });
        } catch (error) {
            console.warn("Direct download failed, opening in new tab", error);
            window.open(document.downloadURL, '_blank');
        } finally {
            setIsDownloading(false);
        }
    }, [document, toast]);

    const handleSaveToDrive = useCallback(async () => {
        if (!document?.downloadURL) return;
        setIsDownloading(true);
        try {
            const response = await fetch(document.downloadURL);
            const blob = await response.blob();
            
            // On mobile/Chrome, Web Share provides a direct "Save to Drive" option
            if (navigator.share) {
                const file = new File([blob], document.name || 'document', { type: blob.type });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: document.name,
                        text: 'Save this document to your Google Drive.',
                    });
                } else {
                    toast({ 
                        title: "Opening Drive", 
                        description: "Sharing files not supported. Opening Google Drive for manual upload." 
                    });
                    window.open("https://drive.google.com/drive/u/0/my-drive", "_blank");
                }
            } else {
                toast({ 
                    title: "Opening Drive", 
                    description: "Please download the file first, then upload it to your Drive." 
                });
                window.open("https://drive.google.com/drive/u/0/my-drive", "_blank");
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Action Failed", description: "Could not open save options." });
        } finally {
            setIsDownloading(false);
        }
    }, [document, toast]);

    if (isLoading) {
        return (
            <div className="container mx-auto p-8 space-y-4">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-[70vh] w-full rounded-2xl" />
            </div>
        );
    }

    if (!document) return null;

    const isPdf = document.downloadURL.toLowerCase().split('?')[0].endsWith('.pdf') || document.downloadURL.includes('sample.pdf');
    const isImage = document.downloadURL.match(/\.(jpeg|jpg|gif|png)$/) != null;

    return (
        <div className="container mx-auto p-4 md:p-8 flex flex-col h-full bg-background overflow-hidden">
            <header className="flex items-center justify-between mb-6 shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="min-w-0">
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate max-w-[300px] sm:max-w-md flex items-center gap-2">
                            {document.isPrivate ? <Lock className="h-5 w-5 text-primary" /> : <Globe className="h-5 w-5 text-accent" />}
                            {document.name}
                        </h1>
                        <p className="text-xs md:text-sm text-muted-foreground">{document.size} • {document.isPrivate ? 'Private Vault' : 'Shared Library'}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="rounded-lg font-bold" 
                                disabled={isDownloading}
                            >
                                {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}
                                Download & Save
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl w-56">
                            <DropdownMenuItem onClick={handleDirectDownload} className="cursor-pointer py-3">
                                <Download className="mr-2 h-4 w-4" />
                                <span>Download to Device</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleSaveToDrive} className="cursor-pointer py-3">
                                <Cloud className="mr-2 h-4 w-4" />
                                <span>Save to Google Drive</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            <main className="flex-1 min-h-0 overflow-hidden">
                <Card className="h-full flex flex-col overflow-hidden shadow-lg border-border/50">
                    <CardContent className="flex-1 p-0 overflow-auto bg-white">
                        {isPdf ? (
                            <iframe 
                                src={`${document.downloadURL}#toolbar=0`} 
                                className="w-full h-full border-none block" 
                                title={document.name}
                            />
                        ) : isImage ? (
                            <div className="p-4 flex items-center justify-center min-h-full">
                                <img src={document.downloadURL} alt={document.name} className="max-w-full h-auto rounded-lg shadow-sm border" />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
                                <FileText className="h-16 w-16 text-muted-foreground opacity-20" />
                                <p className="text-muted-foreground font-medium">This file type cannot be previewed directly.</p>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button className="btn-gel rounded-xl px-8 h-12 text-base font-bold shadow-lg" disabled={isDownloading}>
                                            {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4" />}
                                            Download & Save
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="center" className="rounded-xl w-56">
                                        <DropdownMenuItem onClick={handleDirectDownload} className="cursor-pointer py-3">
                                            <Download className="mr-2 h-4 w-4" />
                                            <span>Download to Device</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={handleSaveToDrive} className="cursor-pointer py-3">
                                            <Cloud className="mr-2 h-4 w-4" />
                                            <span>Save to Google Drive</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
