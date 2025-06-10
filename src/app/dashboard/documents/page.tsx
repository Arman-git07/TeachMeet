
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Lock, Globe, FolderOpen, Search, UploadCloud, CheckCircle, AlertCircle, FilterX, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRef, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { auth, storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL, UploadTaskSnapshot } from 'firebase/storage';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle as ShadDialogTitle, DialogClose } from "@/components/ui/dialog"; // Renamed DialogTitle
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle as ShadAlertDialogTitle } from "@/components/ui/alert-dialog"; // Renamed AlertDialogTitle
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth"; // Added useAuth

interface Document {
  id: string;
  name: string;
  lastModified: string;
  size: string;
  uploaderId: string; // Added uploaderId
}

const initialMockPrivateDocuments: Document[] = [
  { id: "priv-doc-1", name: "My Secret Project Plan.docx", lastModified: "2024-08-15", size: "1.2MB", uploaderId: "mockUser123" },
  { id: "priv-doc-2", name: "Personal Budget Spreadsheet.xlsx", lastModified: "2024-08-10", size: "350KB", uploaderId: "currentUser" }, // Will be deletable if current user matches
];

const initialMockPublicDocuments: Document[] = [
  { id: "pub-doc-1", name: "Community Guidelines Draft.pdf", lastModified: "2024-07-20", size: "800KB", uploaderId: "mockUser123" },
  { id: "pub-doc-2", name: "Open Source Contribution Guide.md", lastModified: "2024-06-05", size: "50KB", uploaderId: "currentUser" },
];


interface DocumentItemProps extends Document {
  onDelete: (id: string, name: string, isPrivate: boolean) => void;
  currentUserId: string | undefined;
}

const DocumentItem = ({ id, name, lastModified, size, uploaderId, onDelete, currentUserId }: DocumentItemProps) => {
  const isOwner = currentUserId === uploaderId || (uploaderId === "currentUser" && currentUserId); // Simplified owner check for mock

  return (
    <div className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-colors group">
      <div className="flex items-center gap-3 min-w-0">
        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <div className="flex-grow min-w-0">
          <p className="text-sm font-medium text-foreground truncate" title={name}>{name}</p>
          <p className="text-xs text-muted-foreground">
            Modified: {new Date(lastModified).toLocaleDateString()} | Size: {size}
          </p>
        </div>
      </div>
      <div className="flex items-center">
        <Button variant="ghost" size="sm" className="rounded-lg flex-shrink-0 ml-2">View</Button>
        {isOwner && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-lg text-destructive opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 ml-1"
            onClick={() => onDelete(id, name, uploaderId === "currentUser")} // Differentiate private for deletion logic
            aria-label="Delete document"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};


interface DocumentSectionProps {
  title: string;
  description: string;
  documents: Document[];
  icon: React.ElementType;
  iconColor: string;
  searchQuery: string;
  className?: string;
  isPrivateSection: boolean;
  onDeleteRequest: (id: string, name: string, isPrivate: boolean) => void;
  currentUserId: string | undefined;
}

const DocumentSection = ({ title, description, documents, icon: Icon, iconColor, searchQuery, className, isPrivateSection, onDeleteRequest, currentUserId }: DocumentSectionProps) => {
  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card className={cn("shadow-lg rounded-xl border-border/50 flex flex-col h-full", className)}>
      <CardHeader className="rounded-t-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`h-6 w-6 ${iconColor}`} />
            <ShadDialogTitle className="text-xl">{title}</ShadDialogTitle> {/* Use renamed ShadDialogTitle */}
          </div>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col space-y-2 overflow-y-auto p-4">
        {documents.length === 0 && searchQuery === '' ? (
          <div className="text-center py-8 text-muted-foreground flex-grow flex flex-col justify-center items-center">
            <FolderOpen className="mx-auto h-12 w-12 mb-2" />
            {title === "Private Documents" ? (
              <p className="text-sm">Your private uploaded documents will appear here.</p>
            ) : title === "Public Documents" ? (
              <p className="text-sm">Publicly shared documents will be listed here.</p>
            ) : (
              <>
                <p>No documents yet.</p>
                <p className="text-xs">Upload and share files.</p>
              </>
            )}
          </div>
        ) : filteredDocuments.length > 0 ? (
          filteredDocuments.map(doc => <DocumentItem key={doc.id} {...doc} onDelete={onDeleteRequest} currentUserId={currentUserId} />)
        ) : (
          <div className="text-center py-8 text-muted-foreground flex-grow flex flex-col justify-center items-center">
            <FilterX className="mx-auto h-12 w-12 mb-2" />
            <p className="text-sm">No documents match your search &quot;{searchQuery}&quot;.</p>
            <p className="text-xs">Try a different search term.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};


export default function DocumentsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user: currentUser, loading: authLoading } = useAuth(); // Get current user

  const [privateDocuments, setPrivateDocuments] = useState<Document[]>(initialMockPrivateDocuments);
  const [publicDocuments, setPublicDocuments] = useState<Document[]>(initialMockPublicDocuments);

  const [isUploadChoiceDialogOpen, setIsUploadChoiceDialogOpen] = useState(false);
  const [uploadDestination, setUploadDestination] = useState<'private' | 'public' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'private' | 'public'>('private');

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{ id: string; name: string; isPrivate: boolean } | null>(null);


  useEffect(() => {
    // Assign 'currentUser' uploaderId based on actual logged-in user for mock data
    // This ensures the delete button appears correctly for items marked 'currentUser'
    const updateUploaderIds = (docs: Document[]): Document[] => 
      docs.map(doc => doc.uploaderId === "currentUser" && currentUser ? { ...doc, uploaderId: currentUser.uid } : doc);

    if (currentUser) {
      setPrivateDocuments(prev => updateUploaderIds(prev));
      setPublicDocuments(prev => updateUploaderIds(prev));
    }
  }, [currentUser]);


  const handleUploadClick = () => {
    if (!auth.currentUser) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please sign in to upload documents.",
      });
      return;
    }
    setIsUploadChoiceDialogOpen(true);
  };

  const initiateUpload = (destination: 'private' | 'public') => {
    setUploadDestination(destination);
    fileInputRef.current?.click();
    setIsUploadChoiceDialogOpen(false);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0 && uploadDestination) {
      const file = files[0];

      if (!auth.currentUser) { 
        toast({
          variant: "destructive",
          title: "Authentication Required",
          description: "Please sign in to upload documents.",
        });
        if (event.target) event.target.value = "";
        setUploadDestination(null);
        return;
      }
      
      const userId = auth.currentUser.uid;
      const filePath = `user_documents/${userId}/${uploadDestination}/${file.name}`;
      const fileRef = storageRef(storage, filePath);
      const uploadTask = uploadBytesResumable(fileRef, file);

      const toastId = `upload-${Date.now()}`;
      toast({ 
        id: toastId,
        title: "Uploading Document...",
        description: (
          <div className="flex items-center">
            <UploadCloud className="mr-2 h-4 w-4 animate-pulse" />
            <span>Starting upload of {file.name} to {uploadDestination}. (0%)</span>
          </div>
        ),
        duration: Infinity, 
      });

      uploadTask.on('state_changed',
        (snapshot: UploadTaskSnapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          toast({
            id: toastId,
            title: "Uploading Document...",
            description: (
              <div className="flex items-center">
                <UploadCloud className="mr-2 h-4 w-4 animate-pulse" />
                <span>Uploading {file.name} to {uploadDestination}. Please wait. ({Math.round(progress)}%)</span>
              </div>
            ),
            duration: Infinity,
          });
        },
        (error) => {
          console.error("Document Upload Error:", error);
          // ... (error handling as before)
          toast({
            id: toastId,
            variant: "destructive",
            title: "Upload Failed",
            description: (
              <div className="flex items-center">
                <AlertCircle className="mr-2 h-4 w-4" />
                <span>Could not upload {file.name}. Error: {error.message}</span>
              </div>
            ),
            duration: 10000, 
          });
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            const newDocument: Document = {
              id: `doc-${Date.now()}`,
              name: file.name,
              lastModified: new Date().toISOString(),
              size: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
              uploaderId: userId,
              // filePath: downloadURL, // Store the actual download URL if needed
            };
            if (uploadDestination === 'private') {
              setPrivateDocuments(prev => [newDocument, ...prev]);
            } else {
              setPublicDocuments(prev => [newDocument, ...prev]);
            }
            toast({
              id: toastId,
              variant: "default", 
              title: "Document Uploaded!",
              description: (
                <div className="flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  <span>{file.name} has been uploaded to {uploadDestination}.</span>
                </div>
              ),
              duration: 5000, 
            });
            console.log("Download URL:", downloadURL);
          } catch (error) {
            console.error("Error getting download URL:", error);
            // ... (error handling for getDownloadURL)
          }
        }
      );

      if (event.target) {
        event.target.value = ""; 
      }
      setUploadDestination(null); 
    }
  };

  const handleOpenDeleteDialog = (id: string, name: string, isPrivate: boolean) => {
    setDocumentToDelete({ id, name, isPrivate });
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDeleteDocument = () => {
    if (!documentToDelete) return;

    if (documentToDelete.isPrivate) {
      setPrivateDocuments(prev => prev.filter(doc => doc.id !== documentToDelete.id));
    } else {
      setPublicDocuments(prev => prev.filter(doc => doc.id !== documentToDelete.id));
    }

    toast({
      title: "Document Deleted",
      description: `"${documentToDelete.name}" has been deleted.`,
    });
    setIsDeleteDialogOpen(false);
    setDocumentToDelete(null);
  };

  return (
    <>
      <div className="space-y-4 flex flex-col h-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">My Documents</h1>
            <p className="text-muted-foreground">Manage your private and public documents.</p>
          </div>
          <div className="flex items-center gap-2">
              <div className="relative w-full md:w-auto md:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input 
                  type="search" 
                  placeholder="Search documents..." 
                  className="pl-10 rounded-lg w-full" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
              />
              </div>
              <Button className="btn-gel rounded-lg" onClick={handleUploadClick}>
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

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'private' | 'public')} className="flex flex-col flex-grow">
          <TabsList className="mb-4 self-start rounded-lg"> 
            <TabsTrigger value="private" className="rounded-md">Private</TabsTrigger> 
            <TabsTrigger value="public" className="rounded-md">Public</TabsTrigger> 
          </TabsList>
          
          <div className="relative flex-1 overflow-hidden">
            <div className={cn(
              "absolute inset-0 transition-all duration-300 ease-in-out flex flex-col",
              activeTab === 'private' 
                ? 'opacity-100 translate-x-0 z-10' 
                : 'opacity-0 -translate-x-full pointer-events-none'
            )}>
              <DocumentSection
                title="Private Documents"
                description="Only visible to you."
                documents={privateDocuments}
                icon={Lock}
                iconColor="text-primary"
                searchQuery={searchQuery}
                className="h-full"
                isPrivateSection={true}
                onDeleteRequest={handleOpenDeleteDialog}
                currentUserId={currentUser?.uid}
              />
            </div>

            <div className={cn(
              "absolute inset-0 transition-all duration-300 ease-in-out flex flex-col",
              activeTab === 'public' 
                ? 'opacity-100 translate-x-0 z-10' 
                : 'opacity-0 translate-x-full pointer-events-none'
            )}>
              <DocumentSection
                title="Public Documents"
                description="Visible to others you share with."
                documents={publicDocuments}
                icon={Globe}
                iconColor="text-accent"
                searchQuery={searchQuery}
                className="h-full"
                isPrivateSection={false}
                onDeleteRequest={handleOpenDeleteDialog}
                currentUserId={currentUser?.uid}
              />
            </div>
          </div>
        </Tabs>
      </div>

      <Dialog open={isUploadChoiceDialogOpen} onOpenChange={setIsUploadChoiceDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-xl"> 
          <DialogHeader>
            <ShadDialogTitle className="text-xl">Choose Upload Destination</ShadDialogTitle> {/* Use renamed ShadDialogTitle */}
            <DialogDescription>
              Where would you like to upload this document?
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <Button 
              variant="outline" 
              className="w-full rounded-lg py-6 text-base" 
              onClick={() => initiateUpload('private')}
            >
              <Lock className="mr-2 h-5 w-5" /> Upload to Private
            </Button>
            <Button 
              variant="outline" 
              className="w-full rounded-lg py-6 text-base" 
              onClick={() => initiateUpload('public')}
            >
              <Globe className="mr-2 h-5 w-5" /> Upload to Public
            </Button>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" className="rounded-lg"> 
                Cancel
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <ShadAlertDialogTitle>Confirm Deletion</ShadAlertDialogTitle> {/* Use renamed ShadAlertDialogTitle */}
            <AlertDialogDescription>
              Are you sure you want to delete the document "{documentToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDeleteDocument} 
              className={cn(buttonVariants({ variant: "destructive", className: "rounded-lg" }))}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
