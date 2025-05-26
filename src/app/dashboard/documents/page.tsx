
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Lock, Globe, FolderOpen, Search, UploadCloud } from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { auth, storage } from '@/lib/firebase'; // Import auth and storage
import { ref as storageRef, uploadBytesResumable, getDownloadURL, UploadTaskSnapshot } from 'firebase/storage'; // Firebase storage functions

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

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];

      if (!auth.currentUser) {
        toast({
          variant: "destructive",
          title: "Authentication Required",
          description: "Please sign in to upload documents.",
        });
        if (event.target) event.target.value = ""; // Reset file input
        return;
      }
      
      const userId = auth.currentUser.uid;
      const filePath = `documents/${userId}/${file.name}`;
      const fileRef = storageRef(storage, filePath);
      const uploadTask = uploadBytesResumable(fileRef, file);

      const toastInstance = toast({ 
        title: "Uploading Document...",
        description: `Starting upload of ${file.name}. (0%)`,
      });

      uploadTask.on('state_changed',
        (snapshot: UploadTaskSnapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          toastInstance.update({ 
            id: toastInstance.id, 
            description: `Uploading ${file.name}. Please wait. (${Math.round(progress)}%)`,
          });
        },
        (error) => {
          console.error("Document Upload Error:", error);
          toastInstance.update({
            id: toastInstance.id,
            variant: "destructive",
            title: "Upload Failed",
            description: "Could not upload your document. Please try again.",
          });
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            toastInstance.update({
              id: toastInstance.id,
              title: "Document Uploaded!",
              description: `${file.name} has been uploaded successfully. URL: ${downloadURL}`, // For dev, can remove URL later
            });
            // Here you would typically save the downloadURL and file metadata to Firestore
            // and update the local state to show the new document in the list.
          } catch (error) {
            console.error("Error getting download URL:", error);
            toastInstance.update({
              id: toastInstance.id,
              variant: "destructive",
              title: "Upload Succeeded, but...",
              description: "Could not get the download URL for the uploaded file.",
            });
          }
        }
      );

      if (event.target) {
        event.target.value = "";
      }
    }
  };

  return (
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
              // To allow multiple files: multiple
              // To specify accepted file types: accept=".pdf,.doc,.docx,image/*"
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
  );
}
