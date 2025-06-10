
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button"; // Import buttonVariants
import { Video as VideoIcon, Lock, Globe, FolderOpen, Search, UploadCloud, CheckCircle, AlertCircle, FilterX, PlayCircle, Download, Settings, Youtube, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRef, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { auth, storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL, UploadTaskSnapshot } from 'firebase/storage';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle as ShadDialogTitle, DialogClose } from "@/components/ui/dialog"; // Renamed DialogTitle
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle as ShadAlertDialogTitle } from "@/components/ui/alert-dialog"; // Renamed AlertDialogTitle
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth"; // Added useAuth

interface Recording {
  id: string;
  name: string;
  date: string;
  duration: string;
  size: string;
  thumbnailUrl?: string;
  filePath?: string;
  uploaderId: string; // Added uploaderId
}

const initialMockPrivateRecordings: Recording[] = [
  {
    id: "priv-rec-1",
    name: "My Private Brainstorm Session",
    date: "2024-08-01",
    duration: "30:15",
    size: "150MB",
    thumbnailUrl: `https://placehold.co/300x180.png?text=Private+Notes`,
    filePath: "/mock-path/private-brainstorm.mp4",
    uploaderId: "currentUser", // Will be deletable if current user matches
  }
];
const initialMockPublicRecordings: Recording[] = [
  {
    id: "pub-rec-1",
    name: "Community Q&A - July",
    date: "2024-07-28",
    duration: "45:12",
    size: "250MB",
    thumbnailUrl: `https://placehold.co/300x180.png?text=Public+Q&A`,
    filePath: "/mock-path/public-q&a-july.mp4",
    uploaderId: "mockUserABC",
  },
  {
    id: "pub-rec-2",
    name: "Guest Lecture: Intro to AI",
    date: "2024-07-15",
    duration: "01:12:30",
    size: "400MB",
    thumbnailUrl: `https://placehold.co/300x180.png?text=AI+Lecture`,
    filePath: "/mock-path/guest-lecture-ai.mp4",
    uploaderId: "currentUser",
  },
  {
    id: "pub-rec-3",
    name: "Product Update Showcase",
    date: "2024-06-30",
    duration: "22:05",
    size: "120MB",
    filePath: "/mock-path/product-update.mp4",
    uploaderId: "mockUserXYZ",
  }
];

interface RecordingItemProps extends Recording {
  isPublic: boolean;
  onDelete: (id: string, name: string, isPrivate: boolean) => void;
  currentUserId: string | undefined;
}

const RecordingItem = ({ id, name, date, duration, size, thumbnailUrl, filePath, isPublic, uploaderId, onDelete, currentUserId }: RecordingItemProps) => {
  const { toast } = useToast();
  const isOwner = currentUserId === uploaderId || (uploaderId === "currentUser" && currentUserId);

  const handleShareToYouTube = () => {
    toast({
      title: "Manual YouTube Upload",
      description: `This is a placeholder. In a real app, "${name}" would be processed for upload. Please upload the file manually to YouTube Studio.`,
      duration: 8000,
    });
    window.open('https://studio.youtube.com/', '_blank', 'noopener,noreferrer');
  };

  const handleDownload = () => {
    if (filePath) {
      toast({ title: "Downloading (Mock)", description: `Would download: ${name}` });
    } else {
      toast({ variant: "destructive", title: "Download Not Available", description: "No file path specified for this recording." });
    }
  };
  
  const handlePlay = () => {
     toast({ title: "Playing (Mock)", description: `Would play: ${name}` });
  }

  return (
    <Card className="rounded-xl shadow-lg hover:shadow-xl transition-shadow border-border/50 overflow-hidden group">
      <div className="relative h-32 sm:h-36 bg-muted/30">
        {thumbnailUrl ? (
          <Image src={thumbnailUrl} alt={`Thumbnail for ${name}`} layout="fill" objectFit="cover" data-ai-hint="video thumbnail"/>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <VideoIcon className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}
        <div className="absolute top-2 right-2 bg-black/60 text-white px-2 py-1 rounded-md text-xs backdrop-blur-sm">
          {duration}
        </div>
        {isOwner && (
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-full h-7 w-7 p-1.5"
            onClick={() => onDelete(id, name, !isPublic)}
            aria-label="Delete recording"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <CardContent className="p-3 space-y-1">
        <p className="text-sm font-medium text-foreground truncate" title={name}>{name}</p>
        <p className="text-xs text-muted-foreground">
          Date: {new Date(date).toLocaleDateString()} | Size: {size} {isPublic && <Globe className="inline h-3 w-3 ml-1 text-accent" />}
        </p>
      </CardContent>
      <CardFooter className="p-3 border-t grid grid-cols-3 gap-2">
        <Button variant="default" size="sm" className="rounded-lg btn-gel text-xs" onClick={handlePlay}>
          <PlayCircle className="mr-1.5 h-4 w-4" /> Play
        </Button>
        {isPublic && filePath ? (
          <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={handleDownload}>
            <Download className="mr-1.5 h-4 w-4" /> Download
          </Button>
        ) : <div /> }
        <Button variant="outline" size="sm" className="rounded-lg text-xs border-red-500/50 text-red-600 hover:bg-red-500/10 hover:text-red-700" onClick={handleShareToYouTube}>
          <Youtube className="mr-1.5 h-4 w-4" /> YT (Manual)
        </Button>
      </CardFooter>
    </Card>
  );
};


interface RecordingSectionProps {
  title: string;
  description: string;
  recordings: Recording[];
  icon: React.ElementType;
  iconColor: string;
  searchQuery: string;
  isPublicSection: boolean;
  className?: string;
  onDeleteRequest: (id: string, name: string, isPrivate: boolean) => void;
  currentUserId: string | undefined;
}

const RecordingSection = ({ title, description, recordings, icon: Icon, iconColor, searchQuery, isPublicSection, className, onDeleteRequest, currentUserId }: RecordingSectionProps) => {
  const filteredRecordings = recordings.filter(rec =>
    rec.name.toLowerCase().includes(searchQuery.toLowerCase())
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
      <CardContent className="flex-grow p-4 overflow-y-auto space-y-0">
        {filteredRecordings.length === 0 && searchQuery === '' && recordings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground flex-grow flex flex-col justify-center items-center h-full">
            <FolderOpen className="mx-auto h-16 w-16 mb-4" />
            <p className="text-base mb-1">{title === "Private Recordings" ? "No Private Recordings Yet." : "No Public Recordings Yet."}</p>
            <p className="text-sm text-muted-foreground">
                {title === "Private Recordings" 
                    ? "Your private recordings will appear here once uploaded." 
                    : "Publicly shared recordings will be listed here."}
            </p>
          </div>
        ) : filteredRecordings.length > 0 ? (
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredRecordings.map(rec => <RecordingItem key={rec.id} {...rec} isPublic={isPublicSection} onDelete={onDeleteRequest} currentUserId={currentUserId} />)}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground flex-grow flex flex-col justify-center items-center h-full">
            <FilterX className="mx-auto h-12 w-12 mb-2" />
            <p className="text-sm">No recordings match your search &quot;{searchQuery}&quot;.</p>
            <p className="text-xs">Try a different search term.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};


export default function RecordingsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user: currentUser, loading: authLoading } = useAuth();

  const [privateRecordings, setPrivateRecordings] = useState<Recording[]>(initialMockPrivateRecordings);
  const [publicRecordings, setPublicRecordings] = useState<Recording[]>(initialMockPublicRecordings);

  const [isUploadChoiceDialogOpen, setIsUploadChoiceDialogOpen] = useState(false);
  const [uploadDestination, setUploadDestination] = useState<'private' | 'public' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'private' | 'public'>('private');

  const [isRecordingDeleteDialogOpen, setIsRecordingDeleteDialogOpen] = useState(false);
  const [recordingToDelete, setRecordingToDelete] = useState<{ id: string; name: string; isPrivate: boolean } | null>(null);

  useEffect(() => {
    const updateUploaderIds = (recs: Recording[]): Recording[] => 
      recs.map(rec => rec.uploaderId === "currentUser" && currentUser ? { ...rec, uploaderId: currentUser.uid } : rec);

    if (currentUser) {
      setPrivateRecordings(prev => updateUploaderIds(prev));
      setPublicRecordings(prev => updateUploaderIds(prev));
    }
  }, [currentUser]);

  const handleUploadClick = () => {
    if (!auth.currentUser) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please sign in to upload recordings.",
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
          description: "Please sign in to upload recordings.",
        });
        if (event.target) event.target.value = "";
        setUploadDestination(null);
        return;
      }
      
      const userId = auth.currentUser.uid;
      const filePath = `user_recordings/${userId}/${uploadDestination}/${file.name}`;
      const fileRef = storageRef(storage, filePath);
      const uploadTask = uploadBytesResumable(fileRef, file);

      const toastId = `upload-recording-${Date.now()}`;
      toast({ 
        id: toastId,
        title: "Uploading Recording...",
        description: (
          <div className="flex items-center">
            <UploadCloud className="mr-2 h-4 w-4 animate-pulse" />
            <span>Starting upload of {file.name}. (0%)</span>
          </div>
        ),
        duration: Infinity, 
      });

      uploadTask.on('state_changed',
        (snapshot: UploadTaskSnapshot) => { 
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          toast({
            id: toastId,
            title: "Uploading Recording...",
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
            console.error("Recording Upload Error:", error);
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
            const newRecording: Recording = {
              id: `rec-${Date.now()}`,
              name: file.name,
              date: new Date().toISOString(),
              duration: "00:00", // Placeholder, actual duration might need to be extracted
              size: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
              uploaderId: userId,
              filePath: downloadURL, // Store actual download URL
              thumbnailUrl: `https://placehold.co/300x180.png?text=NewRec`, // Placeholder thumbnail
            };
             if (uploadDestination === 'private') {
              setPrivateRecordings(prev => [newRecording, ...prev]);
            } else {
              setPublicRecordings(prev => [newRecording, ...prev]);
            }
            toast({
              id: toastId,
              variant: "default", 
              title: "Recording Uploaded!",
              description: (
                 <div className="flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  <span>{file.name} has been uploaded to {uploadDestination}.</span>
                </div>
              ),
              duration: 5000, 
            });
          } catch (error) { 
            console.error("Error getting download URL for recording:", error);
            toast({
              id: toastId, 
              variant: "destructive",
              title: "Upload Finalization Error",
              description: "Recording uploaded, but could not finalize. Please check the list.",
              duration: 7000,
            });
          }
        }
      );

      if (event.target) event.target.value = ""; 
      setUploadDestination(null); 
    }
  };

  const handleOpenRecordingDeleteDialog = (id: string, name: string, isPrivate: boolean) => {
    setRecordingToDelete({ id, name, isPrivate });
    setIsRecordingDeleteDialogOpen(true);
  };

  const handleConfirmDeleteRecording = () => {
    if (!recordingToDelete) return;

    if (recordingToDelete.isPrivate) {
      setPrivateRecordings(prev => prev.filter(rec => rec.id !== recordingToDelete.id));
    } else {
      setPublicRecordings(prev => prev.filter(rec => rec.id !== recordingToDelete.id));
    }

    toast({
      title: "Recording Deleted",
      description: `"${recordingToDelete.name}" has been deleted.`,
    });
    setIsRecordingDeleteDialogOpen(false);
    setRecordingToDelete(null);
  };


  return (
    <>
      <div className="space-y-4 flex flex-col h-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">My Recordings</h1>
            <p className="text-muted-foreground">Manage your private and public recordings.</p>
          </div>
          <div className="flex items-center gap-2">
              <div className="relative w-full md:w-auto md:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input 
                  type="search" 
                  placeholder="Search recordings..." 
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
                accept="video/*,audio/*" 
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
              <RecordingSection
                title="Private Recordings"
                description="Only visible to you."
                recordings={privateRecordings}
                icon={Lock}
                iconColor="text-primary"
                searchQuery={searchQuery}
                isPublicSection={false}
                className="h-full"
                onDeleteRequest={handleOpenRecordingDeleteDialog}
                currentUserId={currentUser?.uid}
              />
            </div>

            <div className={cn(
              "absolute inset-0 transition-all duration-300 ease-in-out flex flex-col",
              activeTab === 'public' 
                ? 'opacity-100 translate-x-0 z-10' 
                : 'opacity-0 translate-x-full pointer-events-none'
            )}>
              <RecordingSection
                title="Public Recordings"
                description="Visible to others you share with."
                recordings={publicRecordings}
                icon={Globe}
                iconColor="text-accent"
                searchQuery={searchQuery}
                isPublicSection={true}
                className="h-full"
                onDeleteRequest={handleOpenRecordingDeleteDialog}
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
              Where would you like to upload this recording?
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

       <AlertDialog open={isRecordingDeleteDialogOpen} onOpenChange={setIsRecordingDeleteDialogOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <ShadAlertDialogTitle>Confirm Deletion</ShadAlertDialogTitle> {/* Use renamed ShadAlertDialogTitle */}
            <AlertDialogDescription>
              Are you sure you want to delete the recording "{recordingToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg" onClick={() => setIsRecordingDeleteDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDeleteRecording} 
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

