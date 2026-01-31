'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Video as VideoIcon, Lock, Globe, FolderOpen, Search, UploadCloud, FilterX, PlayCircle, Download, Youtube, Trash2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { auth, storage, db } from '@/lib/firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, deleteDoc, or, orderBy } from 'firebase/firestore';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";
import type { Recording } from "@/hooks/useAuth";
import { useAuth } from "@/hooks/useAuth";


const RecordingCard = ({ rec, onDelete, currentUserId }: { rec: Recording; onDelete: (id: string, name: string, storagePath: string) => void; currentUserId: string | null }) => {
  const { toast } = useToast();
  const isOwner = currentUserId === rec.uploaderId;

  const handleShareToYouTube = () => {
    toast({ title: "Manual YouTube Upload", description: `Please upload the file manually to YouTube Studio.`, duration: 8000 });
    window.open('https://studio.youtube.com/', '_blank', 'noopener,noreferrer');
  };

  const handlePlay = () => toast({ title: "Playing (Simulation)", description: `Would play: ${rec.name}` });

  return (
    <Card className="rounded-xl shadow-lg hover:shadow-xl transition-shadow border-border/50 overflow-hidden group flex flex-col">
      <div className="relative h-36 bg-muted/30">
        {rec.thumbnailUrl ? (
          <Image src={rec.thumbnailUrl} alt={`Thumbnail for ${rec.name}`} layout="fill" objectFit="cover" data-ai-hint="video thumbnail"/>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <VideoIcon className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}
        <div className="absolute top-2 right-2 bg-black/60 text-white px-2 py-1 rounded-md text-xs backdrop-blur-sm">{rec.duration}</div>
        {isOwner && (
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-full h-7 w-7 p-1.5"
            onClick={() => onDelete(rec.id, rec.name, rec.storagePath)}
            aria-label="Delete recording"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <CardContent className="p-3 space-y-1 flex-grow">
        <p className="text-sm font-medium text-foreground truncate" title={rec.name}>{rec.name}</p>
        <p className="text-xs text-muted-foreground">Date: {rec.date} | Size: {rec.size} {rec.isPrivate ? <Lock className="inline h-3 w-3 ml-1 text-primary" /> : <Globe className="inline h-3 w-3 ml-1 text-accent" />}</p>
      </CardContent>
      <CardFooter className="p-3 border-t grid grid-cols-3 gap-2">
        <Button variant="default" size="sm" className="rounded-lg btn-gel text-xs" onClick={handlePlay}><PlayCircle className="mr-1.5 h-4 w-4" /> Play</Button>
        <Button asChild variant="outline" size="sm" className="rounded-lg text-xs"><a href={rec.downloadURL} download={rec.name}><Download className="mr-1.5 h-4 w-4" /> Download</a></Button>
        <Button variant="outline" size="sm" className="rounded-lg text-xs border-red-500/50 text-red-600 hover:bg-red-500/10 hover:text-red-700" onClick={handleShareToYouTube}><Youtube className="mr-1.5 h-4 w-4" /> YT (Manual)</Button>
      </CardFooter>
    </Card>
  );
};

export function RecordingsClientUI() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const [isUploadChoiceDialogOpen, setIsUploadChoiceDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [recordingToDelete, setRecordingToDelete] = useState<{ id: string; name: string; storagePath: string } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!currentUser) {
      setIsLoading(false);
      setRecordings([]);
      return;
    }

    setIsLoading(true);

    const publicQuery = query(collection(db, "recordings"), 
      where("isPrivate", "==", false),
      orderBy("createdAt", "desc")
    );

    const privateQuery = query(collection(db, "recordings"), 
      where("uploaderId", "==", currentUser.uid),
      where("isPrivate", "==", true),
      orderBy("createdAt", "desc")
    );
    
    let publicRecs: Recording[] = [];
    let privateRecs: Recording[] = [];

    const mergeAndSetRecordings = () => {
      const allRecs = [...publicRecs, ...privateRecs];
      const uniqueRecs = Array.from(new Map(allRecs.map(rec => [rec.id, rec])).values());
      uniqueRecs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setRecordings(uniqueRecs);
    };

    const unsubPublic = onSnapshot(publicQuery, (snapshot) => {
      publicRecs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recording));
      mergeAndSetRecordings();
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching public recordings:", error);
      toast({ variant: 'destructive', title: "Error", description: "Could not fetch public recordings." });
      setIsLoading(false);
    });

    const unsubPrivate = onSnapshot(privateQuery, (snapshot) => {
      privateRecs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recording));
      mergeAndSetRecordings();
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching private recordings:", error);
      toast({ variant: 'destructive', title: "Error", description: "Could not fetch your private recordings." });
      setIsLoading(false);
    });

    return () => {
      unsubPublic();
      unsubPrivate();
    };
  }, [currentUser, toast]);
  
  const handleUploadClick = () => {
    if (!currentUser) {
      toast({ variant: "destructive", title: "Authentication Required", description: "Please sign in to upload recordings." });
      return;
    }
    setIsUploadChoiceDialogOpen(true);
  };

  const initiateUpload = (destination: 'private' | 'public') => {
    setIsUploadChoiceDialogOpen(false);
    fileInputRef.current?.setAttribute('data-destination', destination);
    fileInputRef.current?.click();
  };

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const destination = event.currentTarget.getAttribute('data-destination') as 'private' | 'public' | null;

    if (!file || !destination || !currentUser) return;
    
    setIsUploading(true);
    const toastId = `upload-rec-${Date.now()}`;
    toast({ id: toastId, title: "Uploading Recording...", description: `Uploading ${file.name}...`, duration: Infinity });

    const storagePath = `recordings/${currentUser.uid}/${destination}/${Date.now()}-${file.name}`;
    const fileRef = storageRef(storage, storagePath);
    const uploadTask = uploadBytesResumable(fileRef, file);

    uploadTask.on('state_changed',
      () => {},
      (error) => {
        toast.update(toastId, { variant: "destructive", title: "Upload Failed", description: error.message });
        setIsUploading(false);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          await addDoc(collection(db, "recordings"), {
            name: file.name,
            date: new Date().toLocaleDateString(),
            duration: "N/A", 
            size: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
            uploaderId: currentUser.uid,
            isPrivate: destination === 'private',
            downloadURL,
            storagePath,
            createdAt: serverTimestamp(),
            thumbnailUrl: `https://placehold.co/300x180.png?text=New`,
          });
          toast.update(toastId, { title: "Recording Uploaded!", description: `${file.name} is now available.` });
        } catch (error) {
          toast.update(toastId, { variant: "destructive", title: "Save Failed", description: "Could not save recording details." });
        } finally {
            if (event.target) event.target.value = "";
            setIsUploading(false);
        }
      }
    );
  }, [currentUser, toast]);

  const handleOpenDeleteDialog = (id: string, name: string, storagePath: string) => {
    setRecordingToDelete({ id, name, storagePath });
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDeleteRecording = async () => {
    if (!recordingToDelete) return;
    setIsDeleteDialogOpen(false);
    
    try {
      await deleteDoc(doc(db, "recordings", recordingToDelete.id));
      const fileRef = storageRef(storage, recordingToDelete.storagePath);
      await deleteObject(fileRef);
      toast({ title: "Recording Deleted", description: `"${recordingToDelete.name}" has been successfully deleted.` });
    } catch (error: any) {
       console.error("Deletion failed:", error);
      if (error.code === 'storage/object-not-found') {
          toast({ variant: 'destructive', title: "Deletion Warning", description: "File not found in storage, but removing database entry." });
          try {
             await deleteDoc(doc(db, "recordings", recordingToDelete.id));
          } catch (dbError) {
             toast({ variant: 'destructive', title: "DB Deletion Failed", description: "Could not remove database entry." });
          }
      } else {
         toast({ variant: "destructive", title: "Deletion Failed", description: "Could not delete the recording. Please check console for details." });
      }
    } finally {
        setRecordingToDelete(null);
    }
  };

  const filteredRecordings = useMemo(() => 
    recordings.filter(rec => rec.name.toLowerCase().includes(searchQuery.toLowerCase()))
  , [recordings, searchQuery]);

  const privateRecs = useMemo(() => filteredRecordings.filter(d => d.isPrivate), [filteredRecordings]);
  const publicRecs = useMemo(() => filteredRecordings.filter(d => !d.isPrivate), [filteredRecordings]);

  const renderRecordingGrid = (recs: Recording[], emptyState: React.ReactNode) => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
        </div>
      );
    }
    if (recs.length === 0) {
      return emptyState;
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {recs.map(rec => <RecordingCard key={rec.id} rec={rec} onDelete={handleOpenDeleteDialog} currentUserId={currentUser?.uid || null} />)}
      </div>
    );
  };
  
  const emptyStatePublic = (
    <div className="text-center py-12 text-muted-foreground flex-grow flex flex-col justify-center items-center">
      <FolderOpen className="mx-auto h-12 w-12 mb-2" />
      <p className="text-sm">No public recordings yet.</p>
    </div>
  );

  const emptyStatePrivate = (
    <div className="text-center py-12 text-muted-foreground flex-grow flex flex-col justify-center items-center">
      <FolderOpen className="mx-auto h-12 w-12 mb-2" />
      <p className="text-sm">You have no private recordings.</p>
      <p className="text-xs">Record a meeting or upload a file to start.</p>
    </div>
  );
  
  const noSearchResults = (
    <div className="text-center py-12 text-muted-foreground flex-grow flex flex-col justify-center items-center">
      <FilterX className="mx-auto h-12 w-12 mb-2" />
      <p className="text-sm">No recordings match your search.</p>
    </div>
  );

  return (
    <>
      <div className="space-y-4 flex flex-col h-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">My Recordings</h1>
            <p className="text-muted-foreground">Manage your private and public recordings.</p>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-grow md:flex-grow-0 md:w-auto md:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                placeholder="Search recordings..."
                className="pl-10 rounded-lg w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button className="btn-gel rounded-lg flex-shrink-0" onClick={handleUploadClick} disabled={isUploading}>
              {isUploading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UploadCloud className="mr-2 h-5 w-5" />}
              {isUploading ? "Uploading..." : "Upload"}
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              multiple={false}
              accept="video/*,audio/*"
              disabled={isUploading}
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
              <Card className="shadow-lg rounded-xl border-border/50 bg-transparent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Lock className="text-primary" /> Private Recordings</CardTitle>
                  <CardDescription>Only you can see and manage these recordings.</CardDescription>
                </CardHeader>
                <CardContent>
                  {renderRecordingGrid(privateRecs, searchQuery ? noSearchResults : emptyStatePrivate)}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="public">
              <Card className="shadow-lg rounded-xl border-border/50 bg-transparent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Globe className="text-accent"/> Public Recordings</CardTitle>
                  <CardDescription>These recordings are visible to other users.</CardDescription>
                </CardHeader>
                <CardContent>
                  {renderRecordingGrid(publicRecs, searchQuery ? noSearchResults : emptyStatePublic)}
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
            <DialogDescription>Where would you like to upload this recording?</DialogDescription>
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
              Are you sure you want to delete the recording "{recordingToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteRecording} className={cn(buttonVariants({ variant: "destructive", className: "rounded-lg" }))}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
