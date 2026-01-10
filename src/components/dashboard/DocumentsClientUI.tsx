'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { FileText, Lock, Globe, FolderOpen, Search, UploadCloud, Trash2, Loader2, FilterX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRef, useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { auth, storage, db } from '@/lib/firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, deleteDoc, or, orderBy } from 'firebase/firestore';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import type { Document } from "@/hooks/useAuth";

const DocumentRow = ({ doc, onDelete, currentUserId }: { doc: Document; onDelete: (id: string, name: string, storagePath: string) => void; currentUserId: string | null }) => {
  const isOwner = currentUserId === doc.uploaderId;
  return (
    <div className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-colors group">
      <div className="flex items-center gap-3 min-w-0">
        {doc.isPrivate ? <Lock className="h-5 w-5 text-primary flex-shrink-0" /> : <Globe className="h-5 w-5 text-accent flex-shrink-0" />}
        <div className="flex-grow min-w-0">
          <p className="text-sm font-medium text-foreground truncate" title={doc.name}>{doc.name}</p>
          <p className="text-xs text-muted-foreground">Modified: {new Date(doc.lastModified).toLocaleDateString()} | Size: {doc.size}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button asChild variant="ghost" size="sm" className="rounded-lg flex-shrink-0">
          <a href={doc.downloadURL} target="_blank" rel="noopener noreferrer">View</a>
        </Button>
        {isOwner && (
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
    const docsRef = collection(db, "documents");
    const q = query(docsRef, 
      or(
        where("isPrivate", "==", false), 
        where("uploaderId", "==", currentUser.uid)
      ), 
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        setDocuments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Document)));
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching documents:", error);
        toast({ variant: 'destructive', title: "Error", description: "Could not fetch documents." });
        setIsLoading(false);
      }
    );

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
    fileInputRef.current?.click();
    fileInputRef.current?.setAttribute('data-destination', destination);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const destination = event.currentTarget.getAttribute('data-destination') as 'private' | 'public' | null;

    if (!file || !destination || !currentUser) return;

    const toastId = `upload-${Date.now()}`;
    toast({ id: toastId, title: "Uploading Document...", description: "Please wait...", duration: Infinity });

    const storagePath = `documents/${currentUser.uid}/${destination}/${Date.now()}-${file.name}`;
    const fileRef = storageRef(storage, storagePath);
    const uploadTask = uploadBytesResumable(fileRef, file);

    uploadTask.on('state_changed',
      () => {},
      (error) => {
        toast({ id: toastId, variant: "destructive", title: "Upload Failed", description: error.message });
      },
      async () => {
        try {
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
          toast({ id: toastId, title: "Document Uploaded!", description: `${file.name} is now available.` });
        } catch (error) {
          toast({ id: toastId, variant: "destructive", title: "Save Failed", description: "Could not save document details to the database." });
        } finally {
            if (event.target) event.target.value = "";
        }
      }
    );
  };

  const handleOpenDeleteDialog = (id: string, name: string, storagePath: string) => {
    setDocumentToDelete({ id, name, storagePath });
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDeleteDocument = async () => {
    if (!documentToDelete) return;
    const { id, name, storagePath } = documentToDelete;
    setIsDeleteDialogOpen(false);
    
    try {
      await deleteDoc(doc(db, "documents", id));
      const fileRef = storageRef(storage, storagePath);
      await deleteObject(fileRef);
      
      toast({ title: "Document Deleted", description: `"${name}" has been successfully deleted.` });
      setDocumentToDelete(null); 
    } catch (error: any) {
      console.error("Deletion failed:", error);
      if (error.code === 'storage/object-not-found') {
          toast({ variant: 'destructive', title: "Deletion Warning", description: "File not found in storage, but removing database entry." });
          try {
             await deleteDoc(doc(db, "documents", id));
          } catch (dbError) {
             toast({ variant: 'destructive', title: "DB Deletion Failed", description: "Could not remove database entry." });
          }
      } else {
         toast({ variant: "destructive", title: "Deletion Failed", description: "Could not delete the document. Please check console for details." });
      }
      setDocumentToDelete(null);
    }
  };

  const filteredDocuments = useMemo(() => 
    documents.filter(doc => doc.name.toLowerCase().includes(searchQuery.toLowerCase()))
  , [documents, searchQuery]);

  const privateDocs = useMemo(() => filteredDocuments.filter(d => d.isPrivate), [filteredDocuments]);
  const publicDocs = useMemo(() => filteredDocuments.filter(d => !d.isPrivate), [filteredDocuments]);

  const renderDocumentList = (docs: Document[], emptyState: React.ReactNode) => {
    if (isLoading) {
      return <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>;
    }
    if (docs.length === 0) {
      return emptyState;
    }
    return (
      <div className="space-y-2">
        {docs.map(doc => <DocumentRow key={doc.id} doc={doc} onDelete={handleOpenDeleteDialog} currentUserId={currentUser?.uid || null} />)}
      </div>
    );
  };
  
  const emptyStatePublic = (
    <div className="text-center py-12 text-muted-foreground flex-grow flex flex-col justify-center items-center">
      <FolderOpen className="mx-auto h-12 w-12 mb-2" />
      <p className="text-sm">No public documents yet.</p>
      <p className="text-xs">Share documents publicly for them to appear here.</p>
    </div>
  );

  const emptyStatePrivate = (
    <div className="text-center py-12 text-muted-foreground flex-grow flex flex-col justify-center items-center">
      <FolderOpen className="mx-auto h-12 w-12 mb-2" />
      <p className="text-sm">You have no private documents.</p>
      <p className="text-xs">Upload a document and select "Private" to start.</p>
    </div>
  );
  
  const noSearchResults = (
    <div className="text-center py-12 text-muted-foreground flex-grow flex flex-col justify-center items-center">
      <FilterX className="mx-auto h-12 w-12 mb-2" />
      <p className="text-sm">No documents match your search.</p>
    </div>
  );

  return (
    <>
      <div className="space-y-4 flex flex-col h-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">My Documents</h1>
            <p className="text-muted-foreground">Manage your private and public documents.</p>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-grow md:flex-grow-0 md:w-auto md:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                placeholder="Search documents..."
                className="pl-10 rounded-lg w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button className="btn-gel rounded-lg flex-shrink-0" onClick={handleUploadClick}>
              <UploadCloud className="mr-2 h-5 w-5" /> Upload
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              multiple={false}
            />
          </div>
        </div>

        <Tabs defaultValue="private" className="flex flex-col flex-grow">
          <TabsList className="mb-4 self-start rounded-lg">
            <TabsTrigger value="private" className="rounded-md">Private</TabsTrigger>
            <TabsTrigger value="public" className="rounded-md">Public</TabsTrigger>
          </TabsList>
          <div className="flex-grow overflow-auto">
            <TabsContent value="private">
              <Card className="shadow-lg rounded-xl border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Lock className="text-primary" /> Private Documents</CardTitle>
                  <CardDescription>Only you can see and manage these documents.</CardDescription>
                </CardHeader>
                <CardContent>
                  {renderDocumentList(privateDocs, searchQuery ? noSearchResults : emptyStatePrivate)}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="public">
              <Card className="shadow-lg rounded-xl border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Globe className="text-accent"/> Public Documents</CardTitle>
                  <CardDescription>These documents are visible to other users.</CardDescription>
                </CardHeader>
                <CardContent>
                  {renderDocumentList(publicDocs, searchQuery ? noSearchResults : emptyStatePublic)}
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <Dialog open={isUploadChoiceDialogOpen} onOpenChange={setIsUploadChoiceDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Choose Upload Destination</DialogTitle>
            <DialogDescription>Where would you like to upload this document?</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <Button variant="outline" className="w-full rounded-lg py-6 text-base" onClick={() => initiateUpload('private')}>
              <Lock className="mr-2 h-5 w-5" /> Upload to Private
            </Button>
            <Button variant="outline" className="w-full rounded-lg py-6 text-base" onClick={() => initiateUpload('public')}>
              <Globe className="mr-2 h-5 w-5" /> Upload to Public
            </Button>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="secondary" className="rounded-lg">Cancel</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the document "{documentToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteDocument} className={cn(buttonVariants({ variant: "destructive", className: "rounded-lg" }))}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
