
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Video as VideoIcon, Lock, Globe, FolderOpen, Search, UploadCloud, CheckCircle, AlertCircle, FilterX, PlayCircle, Download, Youtube, Trash2 } from "lucide-react";
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
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

interface Recording {
  id: string;
  name: string;
  date: string;
  duration: string;
  size: string;
  thumbnailUrl?: string;
  downloadURL: string;
  storagePath: string;
  uploaderId: string;
  isPrivate: boolean;
}

const RecordingItem = ({ id, name, date, duration, size, thumbnailUrl, downloadURL, isPrivate, uploaderId, storagePath, onDelete, currentUserId }: Recording & { onDelete: (id: string, name: string, storagePath: string) => void; currentUserId: string | undefined; }) => {
  const { toast } = useToast();
  const isOwner = currentUserId === uploaderId;

  const handleShareToYouTube = () => {
    toast({ title: "Manual YouTube Upload", description: `Please upload the file manually to YouTube Studio.`, duration: 8000 });
    window.open('https://studio.youtube.com/', '_blank', 'noopener,noreferrer');
  };

  const handlePlay = () => toast({ title: "Playing (Simulation)", description: `Would play: ${name}` });

  return (
    <Card className="rounded-xl shadow-lg hover:shadow-xl transition-shadow border-border/50 overflow-hidden group">
      <div className="relative h-32 sm:h-36 bg-muted/30">
        {thumbnailUrl ? <Image src={thumbnailUrl} alt={`Thumbnail for ${name}`} layout="fill" objectFit="cover" data-ai-hint="video thumbnail"/> : <div className="w-full h-full flex items-center justify-center"><VideoIcon className="h-12 w-12 text-muted-foreground/50" /></div>}
        <div className="absolute top-2 right-2 bg-black/60 text-white px-2 py-1 rounded-md text-xs backdrop-blur-sm">{duration}</div>
        {isOwner && <Button variant="destructive" size="icon" className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-full h-7 w-7 p-1.5" onClick={() => onDelete(id, name, storagePath)} aria-label="Delete recording"><Trash2 className="h-4 w-4" /></Button>}
      </div>
      <CardContent className="p-3 space-y-1">
        <p className="text-sm font-medium text-foreground truncate" title={name}>{name}</p>
        <p className="text-xs text-muted-foreground">Date: {date} | Size: {size} {isPrivate ? <Lock className="inline h-3 w-3 ml-1 text-primary" /> : <Globe className="inline h-3 w-3 ml-1 text-accent" />}</p>
      </CardContent>
      <CardFooter className="p-3 border-t grid grid-cols-3 gap-2">
        <Button variant="default" size="sm" className="rounded-lg btn-gel text-xs" onClick={handlePlay}><PlayCircle className="mr-1.5 h-4 w-4" /> Play</Button>
        <Button asChild variant="outline" size="sm" className="rounded-lg text-xs"><a href={downloadURL} download={name}><Download className="mr-1.5 h-4 w-4" /> Download</a></Button>
        <Button variant="outline" size="sm" className="rounded-lg text-xs border-red-500/50 text-red-600 hover:bg-red-500/10 hover:text-red-700" onClick={handleShareToYouTube}><Youtube className="mr-1.5 h-4 w-4" /> YT (Manual)</Button>
      </CardFooter>
    </Card>
  );
};

interface RecordingSectionProps {
  title: string;
  description: string;
  recordings: Recording[];
  isLoading: boolean;
  icon: React.ElementType;
  iconColor: string;
  searchQuery: string;
  isPrivateSection: boolean;
  onDeleteRequest: (id: string, name: string, storagePath: string) => void;
  currentUserId: string | undefined;
}

const RecordingSection = ({ title, description, recordings, isLoading, icon: Icon, iconColor, searchQuery, isPrivateSection, onDeleteRequest, currentUserId }: RecordingSectionProps) => {
  const filteredRecordings = recordings.filter(rec => rec.name.toLowerCase().includes(searchQuery.toLowerCase()));
  return (
    <Card className="shadow-lg rounded-xl border-border/50 flex flex-col h-full">
      <CardHeader className="rounded-t-xl"><div className="flex items-center gap-2"><Icon className={`h-6 w-6 ${iconColor}`} /><ShadDialogTitle className="text-xl">{title}</ShadDialogTitle></div><CardDescription>{description}</CardDescription></CardHeader>
      <CardContent className="flex-grow p-4 overflow-y-auto space-y-0">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4"><Skeleton className="h-60 w-full rounded-xl" /><Skeleton className="h-60 w-full rounded-xl" /><Skeleton className="h-60 w-full rounded-xl" /></div>
        ) : filteredRecordings.length === 0 && searchQuery === '' ? (
          <div className="text-center py-8 text-muted-foreground flex-grow flex flex-col justify-center items-center h-full">
            <FolderOpen className="mx-auto h-16 w-16 mb-4" /><p className="text-base mb-1">No {title.toLowerCase()} yet.</p><p className="text-sm text-muted-foreground">Your {isPrivateSection ? "private" : "public"} recordings will appear here.</p>
          </div>
        ) : filteredRecordings.length > 0 ? (
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredRecordings.map(rec => <RecordingItem key={rec.id} {...rec} onDelete={onDeleteRequest} currentUserId={currentUserId} />)}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground flex-grow flex flex-col justify-center items-center h-full">
            <FilterX className="mx-auto h-12 w-12 mb-2" /><p className="text-sm">No recordings match your search &quot;{searchQuery}&quot;.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function RecordingsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const [privateRecordings, setPrivateRecordings] = useState<Recording[]>([]);
  const [publicRecordings, setPublicRecordings] = useState<Recording[]>([]);
  const [isLoadingPrivate, setIsLoadingPrivate] = useState(true);
  const [isLoadingPublic, setIsLoadingPublic] = useState(true);

  const [isUploadChoiceDialogOpen, setIsUploadChoiceDialogOpen] = useState(false);
  const [uploadDestination, setUploadDestination] = useState<'private' | 'public' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'private' | 'public'>('private');

  const [isRecordingDeleteDialogOpen, setIsRecordingDeleteDialogOpen] = useState(false);
  const [recordingToDelete, setRecordingToDelete] = useState<{ id: string; name: string; storagePath: string } | null>(null);

  useEffect(() => {
    if (!currentUser) { setIsLoadingPrivate(false); setIsLoadingPublic(false); return; }
    const recordingsRef = collection(db, "recordings");
    const privateQuery = query(recordingsRef, where("uploaderId", "==", currentUser.uid), where("isPrivate", "==", true));
    const publicQuery = query(recordingsRef, where("isPrivate", "==", false));
    const privateUnsub = onSnapshot(privateQuery, (snap) => { setPrivateRecordings(snap.docs.map(d => ({id: d.id, ...d.data()} as Recording))); setIsLoadingPrivate(false); });
    const publicUnsub = onSnapshot(publicQuery, (snap) => { setPublicRecordings(snap.docs.map(d => ({id: d.id, ...d.data()} as Recording))); setIsLoadingPublic(false); });
    return () => { privateUnsub(); publicUnsub(); };
  }, [currentUser]);

  const handleUploadClick = () => {
    if (!auth.currentUser) { toast({ variant: "destructive", title: "Authentication Required" }); return; }
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
    const storagePath = `recordings/${userId}/${uploadDestination}/${Date.now()}-${file.name}`;
    const fileRef = storageRef(storage, storagePath);
    const uploadTask = uploadBytesResumable(fileRef, file);
    const toastId = `upload-recording-${Date.now()}`;
    toast({ id: toastId, title: "Uploading Recording...", duration: Infinity });
    uploadTask.on('state_changed',
      () => {}, (error) => toast({ id: toastId, variant: "destructive", title: "Upload Failed", description: error.message }),
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          await addDoc(collection(db, "recordings"), {
            name: file.name, date: new Date().toLocaleDateString(), duration: "00:00", size: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
            uploaderId: userId, isPrivate: uploadDestination === 'private', downloadURL, storagePath, createdAt: serverTimestamp(),
            thumbnailUrl: `https://placehold.co/300x180.png?text=New`,
          });
          toast({ id: toastId, title: "Recording Uploaded!", description: `${file.name} is now available.` });
        } catch (error) { toast({ id: toastId, variant: "destructive", title: "Finalization Failed" }); }
      });
    if (event.target) event.target.value = "";
    setUploadDestination(null);
  };

  const handleOpenRecordingDeleteDialog = (id: string, name: string, storagePath: string) => {
    setRecordingToDelete({ id, name, storagePath });
    setIsRecordingDeleteDialogOpen(true);
  };

  const handleConfirmDeleteRecording = async () => {
    if (!recordingToDelete) return;
    try {
      await deleteDoc(doc(db, "recordings", recordingToDelete.id));
      await deleteObject(storageRef(storage, recordingToDelete.storagePath));
      toast({ title: "Recording Deleted" });
    } catch (error) { toast({ variant: "destructive", title: "Deletion Failed" }); }
    setIsRecordingDeleteDialogOpen(false);
    setRecordingToDelete(null);
  };

  return (
    <>
      <div className="space-y-4 flex flex-col h-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div><h1 className="text-3xl font-bold tracking-tight text-foreground">My Recordings</h1><p className="text-muted-foreground">Manage your private and public recordings.</p></div>
          <div className="flex items-center gap-2">
            <div className="relative w-full md:w-auto md:max-w-xs"><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none" /><Input type="search" placeholder="Search recordings..." className="pl-10 rounded-lg w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
            <Button className="btn-gel rounded-lg" onClick={handleUploadClick}><UploadCloud className="mr-2 h-5 w-5" /> Upload</Button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple={false} accept="video/*,audio/*" />
          </div>
        </div>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'private' | 'public')} className="flex flex-col flex-grow">
          <TabsList className="mb-4 self-start rounded-lg"><TabsTrigger value="private" className="rounded-md">Private</TabsTrigger><TabsTrigger value="public" className="rounded-md">Public</TabsTrigger></TabsList>
          <div className="relative flex-1 overflow-hidden">
            <div className={cn("absolute inset-0 transition-all duration-300 ease-in-out flex flex-col", activeTab === 'private' ? 'opacity-100 translate-x-0 z-10' : 'opacity-0 -translate-x-full pointer-events-none')}>
              <RecordingSection title="Private Recordings" description="Only visible to you." recordings={privateRecordings} isLoading={isLoadingPrivate} icon={Lock} iconColor="text-primary" searchQuery={searchQuery} isPrivateSection={true} onDeleteRequest={handleOpenRecordingDeleteDialog} currentUserId={currentUser?.uid} />
            </div>
            <div className={cn("absolute inset-0 transition-all duration-300 ease-in-out flex flex-col", activeTab === 'public' ? 'opacity-100 translate-x-0 z-10' : 'opacity-0 translate-x-full pointer-events-none')}>
              <RecordingSection title="Public Recordings" description="Visible to others." recordings={publicRecordings} isLoading={isLoadingPublic} icon={Globe} iconColor="text-accent" searchQuery={searchQuery} isPrivateSection={false} onDeleteRequest={handleOpenRecordingDeleteDialog} currentUserId={currentUser?.uid} />
            </div>
          </div>
        </Tabs>
      </div>
      <Dialog open={isUploadChoiceDialogOpen} onOpenChange={setIsUploadChoiceDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-xl"><DialogHeader><ShadDialogTitle className="text-xl">Choose Upload Destination</ShadDialogTitle><DialogDescription>Where would you like to upload this recording?</DialogDescription></DialogHeader>
          <div className="py-6 space-y-4"><Button variant="outline" className="w-full rounded-lg py-6 text-base" onClick={() => initiateUpload('private')}><Lock className="mr-2 h-5 w-5" /> Upload to Private</Button><Button variant="outline" className="w-full rounded-lg py-6 text-base" onClick={() => initiateUpload('public')}><Globe className="mr-2 h-5 w-5" /> Upload to Public</Button></div>
          <DialogFooter><DialogClose asChild><Button type="button" variant="secondary" className="rounded-lg">Cancel</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isRecordingDeleteDialogOpen} onOpenChange={setIsRecordingDeleteDialogOpen}>
        <AlertDialogContent className="rounded-xl"><AlertDialogHeader><ShadAlertDialogTitle>Confirm Deletion</ShadAlertDialogTitle><AlertDialogDescription>Are you sure you want to delete the recording "{recordingToDelete?.name}"? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="rounded-lg" onClick={() => setIsRecordingDeleteDialogOpen(false)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleConfirmDeleteRecording} className={cn(buttonVariants({ variant: "destructive", className: "rounded-lg" }))}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
