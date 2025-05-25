
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Lock, Globe, FolderOpen, Search, UploadCloud, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

const mockPrivateDocuments = [
  { id: "doc_priv_1", name: "Project Proposal Q3.docx", lastModified: "2024-08-15", size: "1.2MB" },
  { id: "doc_priv_2", name: "Personal Notes.txt", lastModified: "2024-08-10", size: "5KB" },
  { id: "doc_priv_3", name: "Financial Report Draft.pdf", lastModified: "2024-08-01", size: "3.5MB" },
];

const mockPublicDocuments = [
  { id: "doc_pub_1", name: "Company Brochure.pdf", lastModified: "2024-07-20", size: "5.0MB" },
  { id: "doc_pub_2", name: "Product Roadmap.pptx", lastModified: "2024-07-15", size: "2.1MB" },
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
  onHeaderClick: () => void;
  isFocusedView: boolean; // True if this section is the single, focused view
  isInSplitView: boolean; // True if the parent view shows both private and public
}

const DocumentSection = ({ title, description, documents, icon: Icon, iconColor, onHeaderClick, isFocusedView, isInSplitView }: DocumentSectionProps) => (
  <Card className={cn("shadow-lg rounded-xl border-border/50 flex flex-col h-full")}>
    <CardHeader onClick={onHeaderClick} className="cursor-pointer hover:bg-muted/30 rounded-t-xl transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-6 w-6 ${iconColor}`} />
          <CardTitle className="text-xl">{title}</CardTitle>
        </div>
        { isInSplitView ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : (isFocusedView ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : null ) }
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
  const [activeView, setActiveView] = useState<'both' | 'private' | 'public'>('both');

  return (
    <div className="space-y-8 flex flex-col h-full"> {/* Page container takes full height and is a flex column */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Documents</h1>
          <p className="text-muted-foreground">Manage your private and public documents. Click on a section to expand.</p>
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
             <Button className="btn-gel rounded-lg">
                <UploadCloud className="mr-2 h-5 w-5" /> Upload
            </Button>
        </div>
      </div>

      <div className={cn(
        "mt-8 flex-1", // This div will grow to fill available vertical space
        activeView === 'both' ? "grid grid-cols-1 md:grid-cols-2 gap-8" : "w-full flex" // Use flex for single view so child h-full works
      )}>
        {(activeView === 'both' || activeView === 'private') && (
          <DocumentSection
            title="Private Documents"
            description="Only visible to you."
            documents={mockPrivateDocuments}
            icon={Lock}
            iconColor="text-primary"
            onHeaderClick={() => setActiveView(activeView === 'private' ? 'both' : 'private')}
            isFocusedView={activeView === 'private'}
            isInSplitView={activeView === 'both'}
          />
        )}
        {(activeView === 'both' || activeView === 'public') && (
          <DocumentSection
            title="Public Documents"
            description="Visible to others you share with."
            documents={mockPublicDocuments}
            icon={Globe}
            iconColor="text-accent"
            onHeaderClick={() => setActiveView(activeView === 'public' ? 'both' : 'public')}
            isFocusedView={activeView === 'public'}
            isInSplitView={activeView === 'both'}
          />
        )}
      </div>
    </div>
  );
}

    