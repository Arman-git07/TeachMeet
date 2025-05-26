
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Lock, Globe, FolderOpen, Search, UploadCloud, CheckCircle, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { auth, storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL, UploadTaskSnapshot } from 'firebase/storage';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";

const mockPrivateDocuments: Array<{ id: string; name: string; lastModified: string; size: string; }> = [
  // { id: "doc_priv_1", name: "Project Proposal Q3.docx", lastModified: "2024-08-15", size: "1.2MB" },
  // { id: "doc_priv_2", name: "Personal Notes.txt", lastModified: "2024-08-10", size: "5KB" },
  // { id: "doc_priv_3", name: "Financial Report Draft.pdf", lastModified: "2024-08-01", size: "3.5MB" },
];

const mockPublicDocuments: Array<{ id: string; name: string; lastModified: string; size: string; }> = [
  // { id: "doc_pub_1", name: "Company Brochure.pdf", lastModified: "2024-07-20", size: "5.0MB" },
  // { id: "doc_pub_2", name: "Product Roadmap.pptx", lastModified: "2024-07-15", size: "2.1MB" },
];

const DocumentItem = ({ name, lastModified, size }: { name: string, lastModified: string, size: string }) => (
  <div className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-colors">
    <div className="flex items-center gap-3 min-w-0">
      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      <div className="flex-grow min-w-0">
        <p className="text-sm font-medium text-foreground truncate" title={name}>{name}</p>
        <p className="text-xs text-muted-foreground">
          Modified: {new Date(lastModified).toLocaleDateString()} | Size: {size}
        </p>
      </div>
    </div>
    <Button variant="ghost" size="sm" className="rounded-md flex-shrink-0 ml-2">View</Button>
  </div>
);

interface DocumentSectionProps {
  title: string;
  description: string;
  documents: Array<{ id: string; name: string; lastModified: string; size: string; }>;
  icon: React.ElementType;
  iconColor: string;
}

const DocumentSection = ({ title, description, documents, icon: Icon, iconColor }: DocumentSectionProps) => (
  <Card className={cn("shadow-lg rounded-xl border-border/50 flex flex-col h-full")}>
    <CardHeader className="rounded-t-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-6 w-6 ${iconColor}`} />
          <CardTitle className="text-xl">{title}</CardTitle>
        </div>
      </div>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent className="flex-grow flex flex-col space-y-2 overflow-y-auto p-4">
      {documents.length > 0 ? (
        documents.map(doc => <DocumentItem key={doc.id} {...doc} />)
      ) : (
        <div className="text-center py-8 text-muted-foreground flex-grow flex flex-col justify-center items-center">
          <FolderOpen className="mx-auto h-12 w-12 mb-2" />
          <p>No documents yet.</p>
          <p className="text-xs">{title === "Private Documents" ? "Upload files to keep them private." : "Upload and share files publicly."}</p>
        </div>
      )}
    </CardContent>
  </Card>
);


export default function DocumentsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isUploadChoiceDialogOpen, setIsUploadChoiceDialogOpen] = useState(false);
  const [uploadDestination, setUploadDestination] = useState<'private' | 'public' | null>(null);

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

      if (!auth.currentUser) { // Redundant check, but good for safety
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
      // Path includes the destination (private/public)
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
        duration: Infinity, // Keep toast until manually dismissed or updated
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
          toast({
            id: toastId,
            variant: "destructive",
            title: "Upload Failed",
            description: (
              <div className="flex items-center">
                <AlertCircle className="mr-2 h-4 w-4" />
                <span>Could not upload {file.name}. Please try again.</span>
              </div>
            ),
            duration: 5000,
          });
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            toast({
              id: toastId,
              variant: "default", // Using default for success look
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
            // Here you would typically save the downloadURL and file metadata to Firestore
            // and update the local state to show the new document in the list.
          } catch (error) {
            console.error("Error getting download URL:", error);
            toast({
              id: toastId,
              variant: "destructive",
              title: "Upload Succeeded, but...",
              description: (
                <div className="flex items-center">
                  <AlertCircle className="mr-2 h-4 w-4" />
                  <span>Could not get the download URL for {file.name}.</span>
                </div>
              ),
              duration: 5000,
            });
          }
        }
      );

      if (event.target) {
        event.target.value = ""; // Reset file input
      }
      setUploadDestination(null); // Reset destination after processing
    }
  };

  return (
    <>
      <div className="space-y-8 flex flex-col h-full">
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
              />
          </div>
        </div>

        <div className={cn(
          "mt-8 flex-1 grid grid-cols-2 gap-8" 
        )}>
          <DocumentSection
              title="Private Documents"
              description="Only visible to you."
              documents={mockPrivateDocuments}
              icon={Lock}
              iconColor="text-primary"
            />
          <DocumentSection
              title="Public Documents"
              description="Visible to others you share with."
              documents={mockPublicDocuments}
              icon={Globe}
              iconColor="text-accent"
            />
        </div>
      </div>

      <Dialog open={isUploadChoiceDialogOpen} onOpenChange={setIsUploadChoiceDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">Choose Upload Destination</DialogTitle>
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
              <Button type="button" variant="secondary" className="rounded-md">
                Cancel
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
