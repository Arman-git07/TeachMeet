'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Globe, FolderOpen, Search, UploadCloud, Trash2, Loader2, FilterX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { storage, db } from '@/lib/firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, deleteDoc, or } from 'firebase/firestore';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import type { Document } from "@/hooks/useAuth";
import Link from "next/link";

const DEMO_DOCUMENTS: Document[] = [
  {
    id: 'demo-private-1',
    name: '[DEMO] Personal Lesson Plan Draft - Math.pdf',
    lastModified: new Date().toISOString(),
    size: '1.2MB',
    uploaderId: 'demo-system',
    isPrivate: true,
    downloadURL: 'https://www.africau.edu/images/default/sample.pdf',
    storagePath: '',
    createdAt: null
  },
  {
    id: 'demo-public-1',
    name: '[DEMO] Physics 101 Classroom Syllabus.pdf',
    lastModified: new Date().toISOString(),
    size: '0.8MB',
    uploaderId: 'demo-system',
    isPrivate: false,
    downloadURL: 'https://www.africau.edu/images/default/sample.pdf',
    storagePath: '',
    createdAt: null
  }
];

const DocumentRow = ({ doc, onDelete, currentUserId }: { doc: Document; onDelete: (id: string, name: string, storagePath: string) => void; currentUserId: string | null }) => {
  const isOwner = currentUserId === doc.uploaderId;
  const isDemo = doc.id.startsWith('demo-');

  return (
    <div className={cn(
        "flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-colors group",
        isDemo && "bg-primary/5 border border-primary/10"
    )}>
      <div className="flex items-center gap-3 min-w-0">
        {doc.isPrivate ? <Lock className="h-5 w-5 text-primary flex-shrink-0" /> : <Globe className="h-5 w-5 text-accent flex-shrink-0" />}
        <div className="flex-grow min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground truncate" title={doc.name}>{doc.name}</p>
            {isDemo && <span className="text-[10px] font-black uppercase bg-primary/20 text-primary px-1.5 py-0.5 rounded">Sample</span>}
          </div>
          <p className="text-xs text-muted-foreground">Modified: {new Date(doc.lastModified).toLocaleDateString()} | Size: {doc.size}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button asChild variant="ghost" size="sm" className="rounded-lg flex-shrink-0">
          <Link href={`/dashboard/documents/${doc.id}`}>View</Link>
        </Button>
        {isOwner && !isDemo && (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-lg text-destructive opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
            onClick={() => onDelete(doc.id, doc.name, doc.storagePath)}
            aria-label="Delete document"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

export function DocumentsClientUI() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const [isUploadChoiceDialogOpen, setIsUploadChoiceDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{ id: string; name: string; storagePath: string } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  
  useEffect(() => {
    if (!currentUser) {
      setIsLoading(false);
      setDocuments([]);
      return;
    }

    setIsLoading(true);
    
    const q = query(
      collection(db, "documents"), 
      or(
        where("isPrivate", "==", false),
        where("uploaderId", "==", currentUser.uid)
      )
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Document));
      
      fetchedDocs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

      setDocuments(fetchedDocs);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching documents:", error);
      toast({ variant: 'destructive', title: "Error", description: "Could not fetch documents." });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, toast]);


  const handleUploadClick = () => {
    if (!currentUser) {
      toast({ variant: "destructive", title: "Authentication Required", description: "Please sign in to upload documents." });
      return;
    }
    setIsUploadChoiceDialogOpen(true);
  };

  const initiateUpload = (destination: 'private' | 'public') => {
    setIsUploadChoiceDialogOpen(false);
    fileInputRef.current?.setAttribute('data-destination', destination);
    fileInputRef.current?.click();
  };

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const destination = event.currentTarget.getAttribute('data-destination') as 'private' | 'public' | null;

    if (!file || !destination || !currentUser) return;
    
    setIsUploading(true);
    const toastHandle = toast({ title: "Uploading Document...", description: `Starting upload for ${file.name}...`, duration: Infinity });

    try {
        const storagePath = `documents/${currentUser.uid}/${destination}/${Date.now()}-${file.name}`;
        const fileRef = storageRef(storage, storagePath);
        const uploadTask = uploadBytesResumable(fileRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                toastHandle.update({
                    id: toastHandle.id,
                    description: `Uploading ${file.name}... ${Math.round(progress)}%`
                });
            }
        );

        await uploadTask;

        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        
        await addDoc(collection(db, "documents"), {
            name: file.name,
            lastModified: new Date().toISOString(),
            size: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
            uploaderId: currentUser.uid,
            isPrivate: destination === 'private',
            downloadURL,
            storagePath,
            createdAt: serverTimestamp(),
        });
        
        toastHandle.update({ id: toastHandle.id, title: "Document Uploaded!", description: `${file.name} is now available.` });
    } catch (error: any) {
        console.error("Failed to upload document:", error);
        toastHandle.update({ id: toastHandle.id, variant: "destructive", title: "Upload Failed", description: "Could not upload the document. Please try again.", duration: 9000 });
    } finally {
        if (event.target) event.target.value = "";
        setIsUploading(false);
    }
  }, [currentUser, toast]);

  const handleOpenDeleteDialog = (id: string, name: string, storagePath: string) => {
    setDocumentToDelete({ id, name, storagePath });
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDeleteDocument = async () => {
    if (!documentToDelete) return;
    const { id, name, storagePath } = documentToDelete;
    
    try {
      if (storagePath) {
          const fileRef = storageRef(storage, storagePath);
          await deleteObject(fileRef);
      }
      await deleteDoc(doc(db, "documents", id));
      toast({ title: "Document Deleted", description: `"${name}" has been successfully deleted.` });
    } catch (error: any) {
      console.error("Deletion failed:", error);
      toast({ variant: "destructive", title: "Deletion Failed", description: "Could not delete the document." });
    } finally {
        setIsDeleteDialogOpen(false);
        setDocumentToDelete(null); 
    }
  };

  const filteredDocuments = useMemo(() => 
    documents.filter(doc => doc.name.toLowerCase().includes(searchQuery.toLowerCase()))
  , [documents, searchQuery]);

  const privateDocs = useMemo(() => {
    const real = filteredDocuments.filter(d => d.isPrivate);
    if (real.length === 0 && !searchQuery) {
        return DEMO_DOCUMENTS.filter(d => d.isPrivate);
    }
    return real;
  }, [filteredDocuments, searchQuery]);

  const publicDocs = useMemo(() => {
    const real = filteredDocuments.filter(d => !d.isPrivate);
    if (real.length === 0 && !searchQuery) {
        return DEMO_DOCUMENTS.filter(d => !d.isPrivate);
    }
    return real;
  }, [filteredDocuments, searchQuery]);

  const renderDocumentList = (docs: Document[]) => {
    if (isLoading) {
      return <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>;
    }
    
    if (docs.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground flex-grow flex flex-col justify-center items-center border-2 border-dashed rounded-2xl">
                <FolderOpen className="mx-auto h-12 w-12 mb-2 opacity-20" />
                <p className="text-sm font-medium">No documents found matching your search.</p>
            </div>
        );
    }

    return (
      <div className="space-y-2">
        {docs.map(doc => <DocumentRow key={doc.id} doc={doc} onDelete={handleOpenDeleteDialog} currentUserId={currentUser?.uid || null} />)}
      </div>
    );
  };

  return (
    <>
      <div className="space-y-4 flex flex-col h-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">My Library</h1>
            <p className="text-muted-foreground">Manage your private resources and shared classroom materials.</p>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-grow md:flex-grow-0 md:w-auto md:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                placeholder="Search documents..."
                className="pl-10 rounded-xl w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button className="btn-gel rounded-xl flex-shrink-0" onClick={handleUploadClick} disabled={isUploading}>
              {isUploading ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <UploadCloud className="mr-2 h-5 w-5" />}
              {isUploading ? "Uploading..." : "Upload"}
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              multiple={false}
              disabled={isUploading}
            />
          </div>
        </div>

        <Tabs defaultValue="private" className="flex flex-col flex-grow">
          <TabsList className="mb-4 self-start rounded-xl bg-muted/50 p-1">
            <TabsTrigger value="private" className="rounded-lg px-6">Private Docs</TabsTrigger>
            <TabsTrigger value="public" className="rounded-lg px-6">Public Docs</TabsTrigger>
          </TabsList>
          <div className="flex-grow overflow-auto pb-12">
            <TabsContent value="private" className="mt-0">
              <Card className="shadow-lg rounded-2xl border-border/50 overflow-hidden">
                <CardHeader className="bg-muted/10 border-b">
                  <div className="flex items-center gap-2">
                    <Lock className="text-primary h-5 w-5" />
                    <CardTitle className="text-lg">Private Vault</CardTitle>
                  </div>
                  <CardDescription>Personal documents only visible to you.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {renderDocumentList(privateDocs)}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="public" className="mt-0">
              <Card className="shadow-lg rounded-2xl border-border/50 overflow-hidden">
                <CardHeader className="bg-muted/10 border-b">
                  <div className="flex items-center gap-2">
                    <Globe className="text-accent h-5 w-5"/>
                    <CardTitle className="text-lg">Shared Library</CardTitle>
                  </div>
                  <CardDescription>Resources visible to everyone in your classrooms.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {renderDocumentList(publicDocs)}
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <Dialog open={isUploadChoiceDialogOpen} onOpenChange={setIsUploadChoiceDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Upload Document</DialogTitle>
            <DialogDescription>Choose a destination for your file.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <Button variant="outline" className="w-full rounded-xl py-8 text-base font-bold border-2 hover:bg-primary/5 hover:border-primary/30 transition-all flex flex-col gap-1" onClick={() => initiateUpload('private')}>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                <span>Private Vault</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-normal uppercase">Only you can access this file</span>
            </Button>
            <Button variant="outline" className="w-full rounded-xl py-8 text-base font-bold border-2 hover:bg-accent/5 hover:border-accent/30 transition-all flex flex-col gap-1" onClick={() => initiateUpload('public')}>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-accent" />
                <span>Public Library</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-normal uppercase">Shared with meeting & class participants</span>
            </Button>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost" className="rounded-xl">Cancel</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete "{documentToDelete?.name}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteDocument} className="bg-destructive text-white rounded-xl hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
