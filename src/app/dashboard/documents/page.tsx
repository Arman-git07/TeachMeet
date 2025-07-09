
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { FileText, Lock, Globe, FolderOpen, Search, UploadCloud, CheckCircle, AlertCircle, FilterX, Trash2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRef, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { auth, storage, db } from '@/lib/firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL, UploadTaskSnapshot, deleteObject } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle as ShadDialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle as ShadAlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

interface Document {
  id: string;
  name: string;
  lastModified: string;
  size: string;
  uploaderId: string;
  isPrivate: boolean;
  downloadURL: string;
  storagePath: string;
}

const DocumentItem = ({ id, name, lastModified, size, uploaderId, onDelete, downloadURL, currentUserId, storagePath, isPrivate }: Document & { onDelete: (id: string, name: string, storagePath: string) => void; currentUserId: string | undefined; }) => {
  const isOwner = currentUserId === uploaderId;
  return (
    <div className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-colors group">
      <div className="flex items-center gap-3 min-w-0">
        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <div className="flex-grow min-w-0">
          <p className="text-sm font-medium text-foreground truncate" title={name}>{name}</p>
          <p className="text-xs text-muted-foreground">Modified: {lastModified} | Size: {size}</p>
        </div>
      </div>
      <div className="flex items-center">
        <Button asChild variant="ghost" size="sm" className="rounded-lg flex-shrink-0 ml-2"><a href={downloadURL} target="_blank" rel="noopener noreferrer">View</a></Button>
        {isOwner && <Button variant="ghost" size="icon" className="rounded-lg text-destructive opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 ml-1" onClick={() => onDelete(id, name, storagePath)} aria-label="Delete document"><Trash2 className="h-4 w-4" /></Button>}
      </div>
    </div>
  );
};

interface DocumentSectionProps {
  title: string;
  description: string;
  documents: Document[];
  isLoading: boolean;
  icon: React.ElementType;
  iconColor: string;
  searchQuery: string;
  onDeleteRequest: (id: string, name: string, storagePath: string) => void;
  currentUserId: string | undefined;
}

const DocumentSection = ({ title, description, documents, isLoading, icon: Icon, iconColor, searchQuery, onDeleteRequest, currentUserId }: DocumentSectionProps) => {
  const filteredDocuments = documents.filter(doc => doc.name.toLowerCase().includes(searchQuery.toLowerCase()));
  return (
    <Card className="shadow-lg rounded-xl border-border/50 flex flex-col h-full">
      <CardHeader className="rounded-t-xl"><div className="flex items-center gap-2"><Icon className={`h-6 w-6 ${iconColor}`} /><ShadDialogTitle className="text-xl">{title}</ShadDialogTitle></div><CardDescription>{description}</CardDescription></CardHeader>
      <CardContent className="flex-grow flex flex-col space-y-2 overflow-y-auto p-4">
        {isLoading ? (
            <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
        ) : documents.length === 0 && searchQuery === '' ? (
          <div className="text-center py-8 text-muted-foreground flex-grow flex flex-col justify-center items-center">
            <FolderOpen className="mx-auto h-12 w-12 mb-2" /><p className="text-sm">Your {title.toLowerCase()} will appear here.</p>
          </div>
        ) : filteredDocuments.length > 0 ? (
          filteredDocuments.map(doc => <DocumentItem key={doc.id} {...doc} onDelete={onDeleteRequest} currentUserId={currentUserId} />)
        ) : (
          <div className="text-center py-8 text-muted-foreground flex-grow flex flex-col justify-center items-center">
            <FilterX className="mx-auto h-12 w-12 mb-2" /><p className="text-sm">No documents match your search &quot;{searchQuery}&quot;.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function DocumentsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user: currentUser, loading: authLoading } = useAuth();
  
  const [privateDocuments, setPrivateDocuments] = useState<Document[]>([]);
  const [publicDocuments, setPublicDocuments] = useState<Document[]>([]);
  const [isLoadingPrivate, setIsLoadingPrivate] = useState(true);
  const [isLoadingPublic, setIsLoadingPublic] = useState(true);

  const [isUploadChoiceDialogOpen, setIsUploadChoiceDialogOpen] = useState(false);
  const [uploadDestination, setUploadDestination] = useState<'private' | 'public' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'private' | 'public'>('private');

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{ id: string; name: string; storagePath: string } | null>(null);

  useEffect(() => {
    if (!currentUser) {
        setIsLoadingPrivate(false);
        setIsLoadingPublic(false);
        return;
    }

    const docsRef = collection(db, "documents");
    
    // Private documents listener
    const privateQuery = query(docsRef, where("uploaderId", "==", currentUser.uid), where("isPrivate", "==", true));
    const privateUnsub = onSnapshot(privateQuery, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Document));
        setPrivateDocuments(docs);
        setIsLoadingPrivate(false);
    });

    // Public documents listener
    const publicQuery = query(docsRef, where("isPrivate", "==", false));
    const publicUnsub = onSnapshot(publicQuery, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Document));
        setPublicDocuments(docs);
        setIsLoadingPublic(false);
    });

    return () => {
        privateUnsub();
        publicUnsub();
    };
  }, [currentUser]);

  const handleUploadClick = () => {
    if (!auth.currentUser) { toast({ variant: "destructive", title: "Authentication Required", description: "Please sign in to upload documents." }); return; }
    setIsUploadChoiceDialogOpen(true);
  };

  const initiateUpload = (destination: 'private' | 'public') => {
    setUploadDestination(destination);
    fileInputRef.current?.click();
    setIsUploadChoiceDialogOpen(false);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !uploadDestination || !auth.currentUser) return;

    const userId = auth.currentUser.uid;
    const storagePath = `documents/${userId}/${uploadDestination}/${Date.now()}-${file.name}`;
    const fileRef = storageRef(storage, storagePath);
    const uploadTask = uploadBytesResumable(fileRef, file);

    const toastId = `upload-${Date.now()}`;
    toast({ id: toastId, title: "Uploading Document...", duration: Infinity });

    uploadTask.on('state_changed',
      (snapshot: UploadTaskSnapshot) => { /* Progress handling can be added here */ },
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
            uploaderId: userId,
            isPrivate: uploadDestination === 'private',
            downloadURL,
            storagePath,
            createdAt: serverTimestamp(),
          });
          toast({ id: toastId, title: "Document Uploaded!", description: `${file.name} is now available.` });
        } catch (error) {
          toast({ id: toastId, variant: "destructive", title: "Finalization Failed", description: "Could not save document details." });
        }
      }
    );
    if (event.target) event.target.value = "";
    setUploadDestination(null);
  };

  const handleOpenDeleteDialog = (id: string, name: string, storagePath: string) => {
    setDocumentToDelete({ id, name, storagePath });
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDeleteDocument = async () => {
    if (!documentToDelete) return;
    try {
        await deleteDoc(doc(db, "documents", documentToDelete.id));
        const fileRef = storageRef(storage, documentToDelete.storagePath);
        await deleteObject(fileRef);
        toast({ title: "Document Deleted", description: `"${documentToDelete.name}" has been deleted.` });
    } catch (error) {
        toast({ variant: "destructive", title: "Deletion Failed", description: "Could not delete the document." });
    }
    setIsDeleteDialogOpen(false);
    setDocumentToDelete(null);
  };

  return (
    <>
      <div className="space-y-4 flex flex-col h-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div><h1 className="text-3xl font-bold tracking-tight text-foreground">My Documents</h1><p className="text-muted-foreground">Manage your private and public documents.</p></div>
          <div className="flex items-center gap-2">
            <div className="relative w-full md:w-auto md:max-w-xs"><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none" /><Input type="search" placeholder="Search documents..." className="pl-10 rounded-lg w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
            <Button className="btn-gel rounded-lg" onClick={handleUploadClick}><UploadCloud className="mr-2 h-5 w-5" /> Upload</Button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple={false} />
          </div>
        </div>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'private' | 'public')} className="flex flex-col flex-grow">
          <TabsList className="mb-4 self-start rounded-lg"><TabsTrigger value="private" className="rounded-md">Private</TabsTrigger><TabsTrigger value="public" className="rounded-md">Public</TabsTrigger></TabsList>
          <div className="relative flex-1 overflow-hidden">
            <div className={cn("absolute inset-0 transition-all duration-300 ease-in-out flex flex-col", activeTab === 'private' ? 'opacity-100 translate-x-0 z-10' : 'opacity-0 -translate-x-full pointer-events-none')}>
              <DocumentSection title="Private Documents" description="Only visible to you." documents={privateDocuments} isLoading={isLoadingPrivate} icon={Lock} iconColor="text-primary" searchQuery={searchQuery} onDeleteRequest={handleOpenDeleteDialog} currentUserId={currentUser?.uid} />
            </div>
            <div className={cn("absolute inset-0 transition-all duration-300 ease-in-out flex flex-col", activeTab === 'public' ? 'opacity-100 translate-x-0 z-10' : 'opacity-0 translate-x-full pointer-events-none')}>
              <DocumentSection title="Public Documents" description="Visible to others." documents={publicDocuments} isLoading={isLoadingPublic} icon={Globe} iconColor="text-accent" searchQuery={searchQuery} onDeleteRequest={handleOpenDeleteDialog} currentUserId={currentUser?.uid} />
            </div>
          </div>
        </Tabs>
      </div>
      <Dialog open={isUploadChoiceDialogOpen} onOpenChange={setIsUploadChoiceDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-xl"><DialogHeader><ShadDialogTitle className="text-xl">Choose Upload Destination</ShadDialogTitle><DialogDescription>Where would you like to upload this document?</DialogDescription></DialogHeader>
          <div className="py-6 space-y-4"><Button variant="outline" className="w-full rounded-lg py-6 text-base" onClick={() => initiateUpload('private')}><Lock className="mr-2 h-5 w-5" /> Upload to Private</Button><Button variant="outline" className="w-full rounded-lg py-6 text-base" onClick={() => initiateUpload('public')}><Globe className="mr-2 h-5 w-5" /> Upload to Public</Button></div>
          <DialogFooter><DialogClose asChild><Button type="button" variant="secondary" className="rounded-lg">Cancel</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-xl"><AlertDialogHeader><ShadAlertDialogTitle>Confirm Deletion</ShadAlertDialogTitle><AlertDialogDescription>Are you sure you want to delete the document "{documentToDelete?.name}"? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="rounded-lg" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleConfirmDeleteDocument} className={cn(buttonVariants({ variant: "destructive", className: "rounded-lg" }))}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
