
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video as VideoIcon, Lock, Globe, FolderOpen, Search, UploadCloud, CheckCircle, AlertCircle, FilterX, PlayCircle, Download, Settings, Youtube } from "lucide-react"; // Added Youtube icon
import { Input } from "@/components/ui/input";
import { useRef, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { auth, storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL, UploadTaskSnapshot } from 'firebase/storage';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from "next/image";
import Link from "next/link";

interface Recording {
  id: string;
  name: string;
  date: string;
  duration: string;
  size: string;
  thumbnailUrl?: string;
  filePath?: string; // Assuming you might store a path to the actual file for download/manual upload
}

const mockPrivateRecordings: Recording[] = [ // Added one private for testing
  {
    id: "priv-rec-1",
    name: "My Private Brainstorm Session",
    date: "2024-08-01",
    duration: "30:15",
    size: "150MB",
    thumbnailUrl: `https://placehold.co/300x180.png?text=Private+Notes`,
    filePath: "/mock-path/private-brainstorm.mp4", // Private can also have filePath
  }
];
const mockPublicRecordings: Recording[] = [
  {
    id: "pub-rec-1",
    name: "Community Q&A - July",
    date: "2024-07-28",
    duration: "45:12",
    size: "250MB",
    thumbnailUrl: `https://placehold.co/300x180.png?text=Public+Q&A`,
    filePath: "/mock-path/public-q&a-july.mp4",
  },
  {
    id: "pub-rec-2",
    name: "Guest Lecture: Intro to AI",
    date: "2024-07-15",
    duration: "01:12:30",
    size: "400MB",
    thumbnailUrl: `https://placehold.co/300x180.png?text=AI+Lecture`,
    filePath: "/mock-path/guest-lecture-ai.mp4",
  },
  {
    id: "pub-rec-3",
    name: "Product Update Showcase",
    date: "2024-06-30",
    duration: "22:05",
    size: "120MB",
    // No thumbnailUrl, will show placeholder icon
    filePath: "/mock-path/product-update.mp4",
  }
];

interface RecordingItemProps extends Recording {
  isPublic: boolean;
}

const RecordingItem = ({ name, date, duration, size, thumbnailUrl, filePath, isPublic }: RecordingItemProps) => {
  const { toast } = useToast();

  const handleShareToYouTube = () => {
    toast({
      title: "Manual YouTube Upload",
      description: `This is a placeholder. In a real app, "${name}" would be processed for upload. Please upload the file manually to YouTube Studio.`,
      duration: 8000,
    });
    window.open('https://studio.youtube.com/', '_blank', 'noopener,noreferrer');
  };

  const handleDownload = () => {
    // This is a mock download. In a real app, you'd use filePath or a download URL.
    if (filePath) {
      toast({ title: "Downloading (Mock)", description: `Would download: ${name}` });
      // window.open(filePath, '_blank'); // Example for direct link
    } else {
      toast({ variant: "destructive", title: "Download Not Available", description: "No file path specified for this recording." });
    }
  };
  
  const handlePlay = () => {
     toast({ title: "Playing (Mock)", description: `Would play: ${name}` });
     // In a real app, this would open a video player with the recording
  }

  return (
    <Card className="rounded-xl shadow-lg hover:shadow-xl transition-shadow border-border/50 overflow-hidden">
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
      </div>
      <CardContent className="p-3 space-y-1">
        <p className="text-sm font-medium text-foreground truncate" title={name}>{name}</p>
        <p className="text-xs text-muted-foreground">
          Date: {new Date(date).toLocaleDateString()} | Size: {size} {isPublic && <Globe className="inline h-3 w-3 ml-1 text-accent" />}
        </p>
      </CardContent>
      <CardFooter className="p-3 border-t grid grid-cols-3 gap-2"> {/* Changed to grid-cols-3 */}
        <Button variant="default" size="sm" className="rounded-lg btn-gel text-xs" onClick={handlePlay}>
          <PlayCircle className="mr-1.5 h-4 w-4" /> Play
        </Button>
        {isPublic && filePath ? (
          <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={handleDownload}>
            <Download className="mr-1.5 h-4 w-4" /> Download
          </Button>
        ) : <div /> /* Placeholder for grid alignment if button not shown */}
        <Button variant="outline" size="sm" className="rounded-lg text-xs border-red-500/50 text-red-600 hover:bg-red-500/10 hover:text-red-700" onClick={handleShareToYouTube}> {/* Custom style for YouTube button */}
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
  isPublicSection: boolean; // New prop
  className?: string;
}

const RecordingSection = ({ title, description, recordings, icon: Icon, iconColor, searchQuery, isPublicSection, className }: RecordingSectionProps) => {
  const filteredRecordings = recordings.filter(rec =>
    rec.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card className={cn("shadow-lg rounded-xl border-border/50 flex flex-col h-full", className)}>
      <CardHeader className="rounded-t-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`h-6 w-6 ${iconColor}`} />
            <CardTitle className="text-xl">{title}</CardTitle>
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
            {filteredRecordings.map(rec => <RecordingItem key={rec.id} {...rec} isPublic={isPublicSection} />)}
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
  const [isUploadChoiceDialogOpen, setIsUploadChoiceDialogOpen] = useState(false);
  const [uploadDestination, setUploadDestination] = useState<'private' | 'public' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'private' | 'public'>('private');

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
          let errorTitle = "Upload Failed";
          let errorMessage = `Could not upload ${file.name}. Please try again.`;

          if (error.code === 'storage/unauthorized') {
            errorMessage = `You are not authorized to upload ${file.name}. Please check storage rules in Firebase.`;
          } else if (error.code === 'storage/canceled') {
            errorMessage = `Upload of ${file.name} was canceled.`;
          } else if (error.code === 'storage/retry-limit-exceeded') {
            errorTitle = "Upload Timed Out";
            errorMessage = `The upload of ${file.name} took too long and timed out. Please check your internet connection and try again. If the problem persists, check the Firebase status page.`;
          }

          toast({
            id: toastId,
            variant: "destructive",
            title: errorTitle,
            description: (
              <div className="flex items-center">
                <AlertCircle className="mr-2 h-4 w-4" />
                <span>{errorMessage}</span>
              </div>
            ),
            duration: 10000,
          });
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
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
            console.log("Recording Download URL:", downloadURL);
            // TODO: Save downloadURL and recording metadata to Firestore
            // TODO: Update local state to show the new recording in the list.
          } catch (error) {
            console.error("Error getting download URL for recording:", error);
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
        event.target.value = ""; 
      }
      setUploadDestination(null); 
    }
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
                recordings={mockPrivateRecordings}
                icon={Lock}
                iconColor="text-primary"
                searchQuery={searchQuery}
                isPublicSection={false}
                className="h-full"
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
                recordings={mockPublicRecordings}
                icon={Globe}
                iconColor="text-accent"
                searchQuery={searchQuery}
                isPublicSection={true}
                className="h-full"
              />
            </div>
          </div>
        </Tabs>
      </div>

      <Dialog open={isUploadChoiceDialogOpen} onOpenChange={setIsUploadChoiceDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Choose Upload Destination</DialogTitle>
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
    </>
  );
}
