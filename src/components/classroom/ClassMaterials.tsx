
'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, query, onSnapshot, orderBy, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { useClassroom } from '@/contexts/ClassroomContext';
import { canManage } from '@/lib/roles';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Loader2, Link as LinkIcon, Trash2, FileText } from 'lucide-react';
import type { Material } from '@/app/dashboard/classrooms/[classroomId]/page';

export function ClassMaterials() {
    const { classroomId, user, userRole } = useClassroom();
    const { toast } = useToast();
    const [materials, setMaterials] = useState<Material[]>([]);
    const [file, setFile] = useState<File | null>(null);
    const [link, setLink] = useState('');
    const [linkName, setLinkName] = useState('');
    const [loading, setLoading] = useState(false);
    const canUserManage = canManage(userRole);

    useEffect(() => {
        if (!classroomId) return;
        const q = query(collection(db, 'classrooms', classroomId, 'materials'), orderBy('uploadedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMaterials(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Material)));
        }, (error) => {
            console.error("Error fetching materials:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not fetch class materials." });
        });
        return unsubscribe;
    }, [classroomId, toast]);

    const handleUpload = async () => {
        if (!file || !user || !classroomId) return;
        setLoading(true);
        try {
            const path = `classrooms/${classroomId}/materials/${Date.now()}-${file.name}`;
            const fileRef = storageRef(storage, path);
            const uploadTask = uploadBytesResumable(fileRef, file);
            
            await uploadTask;
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            
            await addDoc(collection(db, 'classrooms', classroomId, 'materials'), {
                name: file.name, 
                url, 
                uploadedAt: serverTimestamp(), 
                uploaderId: user.uid, 
                uploaderName: user.displayName || 'Teacher', 
                type: 'file', 
                storagePath: path,
            });
            toast({ title: "Material Uploaded!" });
            setFile(null);
        } catch (e) { 
            console.error("Upload failed:", e);
            toast({ variant: 'destructive', title: "Upload Failed" }); 
        } finally { 
            setLoading(false); 
        }
    };

    const handleShareLink = async () => {
        if (!link.trim() || !linkName.trim() || !user || !classroomId) return;
        setLoading(true);
        try {
            await addDoc(collection(db, 'classrooms', classroomId, 'materials'), {
                name: linkName.trim(), 
                url: link.trim(), 
                uploadedAt: serverTimestamp(), 
                uploaderId: user.uid, 
                uploaderName: user.displayName || 'Teacher', 
                type: 'link', 
                storagePath: '',
            });
            toast({ title: "Link Shared!" });
            setLink(''); 
            setLinkName('');
        } catch (e) { 
            console.error("Link share failed:", e);
            toast({ variant: 'destructive', title: "Failed to share link" }); 
        } finally { 
            setLoading(false); 
        }
    };

    const handleDelete = async (material: Material) => {
        if (!classroomId) return;
        try {
            if (material.storagePath) {
                const fileRef = storageRef(storage, material.storagePath);
                await deleteObject(fileRef).catch(err => {
                    if (err.code !== 'storage/object-not-found') throw err;
                });
            }
            await deleteDoc(doc(db, "classrooms", classroomId, "materials", material.id));
            toast({ title: "Material Deleted" });
        } catch (error) {
            console.error("Delete failed:", error);
            toast({ variant: 'destructive', title: "Deletion Failed" });
        }
    };

    return (
        <Card className="border-0 shadow-none bg-transparent">
            <CardContent className="space-y-4 pt-6 px-0">
                {canUserManage && (
                    <Card className="p-4 bg-muted/20 border-dashed">
                        <Tabs defaultValue="file">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="file">Upload File</TabsTrigger>
                                <TabsTrigger value="link">Share Link</TabsTrigger>
                            </TabsList>
                            <TabsContent value="file" className="pt-4 space-y-4">
                                <div className="flex gap-2">
                                    <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} disabled={loading} className="flex-1 rounded-lg" />
                                    <Button onClick={handleUpload} disabled={!file || loading} className="rounded-lg">
                                        {loading ? <Loader2 className="animate-spin h-4 w-4"/> : <Upload className="h-4 w-4"/>}
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground italic">Files are kept permanently until deleted.</p>
                            </TabsContent>
                            <TabsContent value="link" className="pt-4 space-y-4">
                                <Input placeholder="Link Name (e.g., Maths Class Link)" value={linkName} onChange={(e) => setLinkName(e.target.value)} disabled={loading} className="rounded-lg" />
                                <Input placeholder="https://example.com" value={link} onChange={(e) => setLink(e.target.value)} disabled={loading} className="rounded-lg" />
                                <Button onClick={handleShareLink} disabled={!link || !linkName || loading} className="w-full rounded-lg">Share Link</Button>
                            </TabsContent>
                        </Tabs>
                    </Card>
                )}
                
                <div className="grid gap-3">
                    {materials.length > 0 ? materials.map(m => (
                        <div key={m.id} className="flex items-center justify-between p-3 bg-card border rounded-xl group hover:shadow-sm transition-all">
                            <a href={m.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 truncate flex-1">
                                <div className={cn("p-2 rounded-lg", m.type === 'link' ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary")}>
                                    {m.type === 'link' ? <LinkIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                </div>
                                <div className="truncate">
                                    <span className="text-sm font-medium block truncate">{m.name}</span>
                                    <span className="text-[10px] text-muted-foreground uppercase">{m.type} • Added by {m.uploaderName}</span>
                                </div>
                            </a>
                            {(canUserManage || m.uploaderId === user?.uid) && (
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="opacity-0 group-hover:opacity-100 text-destructive/70 hover:text-destructive hover:bg-destructive/10" 
                                    onClick={() => handleDelete(m)}
                                >
                                    <Trash2 className="h-4 w-4"/>
                                </Button>
                            )}
                        </div>
                    )) : (
                        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                            <p className="text-sm">No materials have been uploaded to this classroom yet.</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
