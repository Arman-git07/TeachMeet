
'use client';

import { useState, useEffect, useCallback, memo } from 'react';
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
        return onSnapshot(q, (snapshot) => {
            setMaterials(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Material)));
        });
    }, [classroomId]);

    const handleUpload = async () => {
        if (!file || !user || !classroomId) return;
        setLoading(true);
        try {
            const path = `classrooms/${classroomId}/materials/${Date.now()}-${file.name}`;
            const fileRef = storageRef(storage, path);
            const url = await getDownloadURL(await uploadBytesResumable(fileRef, file).then(s => s.ref));
            await addDoc(collection(db, 'classrooms', classroomId, 'materials'), {
                name: file.name, url, uploadedAt: serverTimestamp(), uploaderId: user.uid, uploaderName: user.displayName || 'Teacher', type: 'file', storagePath: path,
            });
            toast({ title: "Uploaded!" });
            setFile(null);
        } catch (e) { toast({ variant: 'destructive', title: "Failed" }); } finally { setLoading(false); }
    };

    const handleShareLink = async () => {
        if (!link.trim() || !linkName.trim() || !user || !classroomId) return;
        setLoading(true);
        try {
            await addDoc(collection(db, 'classrooms', classroomId, 'materials'), {
                name: linkName.trim(), url: link.trim(), uploadedAt: serverTimestamp(), uploaderId: user.uid, uploaderName: user.displayName || 'Teacher', type: 'link', storagePath: '',
            });
            toast({ title: "Link Shared!" });
            setLink(''); setLinkName('');
        } catch (e) { toast({ variant: 'destructive', title: "Failed" }); } finally { setLoading(false); }
    };

    return (
        <Card>
            <CardContent className="space-y-4 pt-6">
                {canUserManage && (
                    <Card className="p-4 bg-muted/20">
                        <Tabs defaultValue="file">
                            <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="file">File</TabsTrigger><TabsTrigger value="link">Link</TabsTrigger></TabsList>
                            <TabsContent value="file" className="pt-4 flex gap-2">
                                <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} disabled={loading} className="flex-1"/>
                                <Button onClick={handleUpload} disabled={!file || loading}>{loading ? <Loader2 className="animate-spin"/> : <Upload className="h-4 w-4"/>}</Button>
                            </TabsContent>
                            <TabsContent value="link" className="pt-4 space-y-4">
                                <Input placeholder="Link Name (e.g., Maths Class Link, English Class Link)" value={linkName} onChange={(e) => setLinkName(e.target.value)} disabled={loading} />
                                <Input placeholder="https://example.com" value={link} onChange={(e) => setLink(e.target.value)} disabled={loading} />
                                <Button onClick={handleShareLink} disabled={!link || !linkName || loading} className="w-full">Share Link</Button>
                            </TabsContent>
                        </Tabs>
                    </Card>
                )}
                <div className="space-y-2">
                    {materials.map(m => (
                        <div key={m.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg group">
                            <a href={m.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 truncate">
                                {m.type === 'link' ? <LinkIcon className="h-4 w-4 text-accent" /> : <FileText className="h-4 w-4 text-primary" />}
                                <span className="text-sm font-medium truncate">{m.name}</span>
                            </a>
                            {canUserManage && <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" onClick={async () => { if(m.storagePath) await deleteObject(storageRef(storage, m.storagePath)).catch(()=>{}); await deleteDoc(doc(db, "classrooms", classroomId!, "materials", m.id)); toast({title:"Deleted"}); }}><Trash2 className="h-4 w-4 text-destructive"/></Button>}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
