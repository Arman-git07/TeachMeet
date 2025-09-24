
'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { collection, query, onSnapshot, orderBy, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useClassroom } from '@/contexts/ClassroomContext';
import { canManage } from '@/lib/roles';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Loader2, Link as LinkIcon, Trash2, FileText } from 'lucide-react';
import { AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { Material, DeletableItem } from '@/app/dashboard/classrooms/[classroomId]/page';

const MaterialItem = memo(({ material, canDelete, onDeleteClick }: { material: Material; canDelete: boolean; onDeleteClick: () => void }) => {
    return (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg group">
            <a href={material.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 min-w-0 flex-grow">
                {material.type === 'link' ? <LinkIcon className="h-5 w-5 text-accent flex-shrink-0" /> : <FileText className="h-5 w-5 text-primary flex-shrink-0" />}
                <div className="min-w-0">
                    <p className="text-sm font-medium truncate" title={material.name}>{material.name}</p>
                    <p className="text-xs text-muted-foreground">Shared by {material.uploaderName}</p>
                </div>
            </a>
            {canDelete && (
                <AlertDialogTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive/70 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={onDeleteClick}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </AlertDialogTrigger>
            )}
        </div>
    );
});
MaterialItem.displayName = 'MaterialItem';

export function ClassMaterials() {
    const { classroomId, user, userRole } = useClassroom();
    const { toast } = useToast();
    const [materials, setMaterials] = useState<Material[]>([]);
    const [materialFile, setMaterialFile] = useState<File | null>(null);
    const [materialLink, setMaterialLink] = useState('');
    const [materialName, setMaterialName] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const canUserManage = canManage(userRole);

    useEffect(() => {
        if (!classroomId) return;
        const q = query(collection(db, 'classrooms', classroomId, 'materials'), orderBy('uploadedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMaterials(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Material)));
        }, (error) => {
            console.error("Error fetching materials:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not fetch materials." });
        });
        return unsubscribe;
    }, [classroomId, toast]);

    const handleDelete = useCallback(async (itemToDelete: DeletableItem | null) => {
        if (!itemToDelete || !classroomId) return;
        const { collectionName, item } = itemToDelete;
        try {
            if (item.storagePath) {
                const fileRef = storageRef(storage, item.storagePath);
                await deleteObject(fileRef).catch(err => {
                    if (err.code !== 'storage/object-not-found') throw err;
                });
            }
            await deleteDoc(doc(db, "classrooms", classroomId, collectionName, item.id));
            toast({ title: "Item Deleted", description: "The material has been removed." });
        } catch (error: any) {
            console.error("Error deleting material:", error);
            toast({ variant: 'destructive', title: "Deletion Failed", description: error.message });
        }
    }, [classroomId, toast]);

    const handleMaterialUpload = useCallback(async () => {
        if (!materialFile || !user) return;
        setIsUploading(true);
        const toastId = `upload-${Date.now()}`;
        toast({ id: toastId, title: "Uploading...", description: "Please wait." });
        try {
            const path = `classrooms/${classroomId}/materials/${Date.now()}-${materialFile.name}`;
            const fileRef = storageRef(storage, path);
            const snapshot = await uploadBytes(fileRef, materialFile);
            const url = await getDownloadURL(snapshot.ref);
            await addDoc(collection(db, 'classrooms', classroomId, 'materials'), {
                name: materialFile.name, url, uploadedAt: serverTimestamp(), uploaderId: user.uid, uploaderName: user.displayName || 'Anonymous', type: 'file', storagePath: path,
            });
            toast.update(toastId, { title: "Material Uploaded!" });
            setMaterialFile(null);
        } catch (error) {
            toast.update(toastId, { variant: "destructive", title: "Upload Failed" });
        } finally {
            setIsUploading(false);
        }
    }, [materialFile, user, classroomId, toast]);

    const handleLinkShare = useCallback(async () => {
        if (!materialLink.trim() || !materialName.trim() || !user) return;
        setIsUploading(true);
        try {
            await addDoc(collection(db, 'classrooms', classroomId, 'materials'), {
                name: materialName.trim(), url: materialLink.trim(), uploadedAt: serverTimestamp(), uploaderId: user.uid, uploaderName: user.displayName || 'Anonymous', type: 'link', storagePath: '',
            });
            toast({ title: "Link Shared!" });
            setMaterialLink('');
            setMaterialName('');
        } catch (error) {
            toast({ variant: "destructive", title: "Sharing Failed" });
        } finally {
            setIsUploading(false);
        }
    }, [materialLink, materialName, user, classroomId, toast]);

    return (
        <Card>
            <CardContent className="space-y-4 pt-6">
                {canUserManage && (
                    <Card className="p-4 bg-muted/20">
                        <Tabs defaultValue="file">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="file">Upload File</TabsTrigger>
                                <TabsTrigger value="link">Share Link</TabsTrigger>
                            </TabsList>
                            <TabsContent value="file" className="pt-4">
                                <div className="flex gap-2">
                                    <Input id="material-upload" type="file" onChange={(e) => setMaterialFile(e.target.files ? e.target.files[0] : null)} disabled={isUploading} />
                                    <Button onClick={handleMaterialUpload} disabled={!materialFile || isUploading}>
                                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} Upload
                                    </Button>
                                </div>
                            </TabsContent>
                            <TabsContent value="link" className="pt-4 space-y-4">
                                <Input placeholder="Link Name (e.g., React Docs)" value={materialName} onChange={(e) => setMaterialName(e.target.value)} disabled={isUploading} />
                                <Input placeholder="https://example.com" value={materialLink} onChange={(e) => setMaterialLink(e.target.value)} disabled={isUploading} />
                                <Button onClick={handleLinkShare} disabled={!materialLink || !materialName || isUploading}>
                                    {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />} Share Link
                                </Button>
                            </TabsContent>
                        </Tabs>
                    </Card>
                )}
                <div className="space-y-2">
                    {materials.length > 0 ? materials.map(m => (
                        <MaterialItem key={m.id} material={m} canDelete={canUserManage || user?.uid === m.uploaderId} onDeleteClick={() => handleDelete({ collectionName: 'materials', item: m })} />
                    )) : <p className="text-muted-foreground text-center py-6">No materials shared yet.</p>}
                </div>
            </CardContent>
        </Card>
    );
}
