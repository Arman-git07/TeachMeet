
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, UploadCloud, ArrowLeft, Download, Eye, Link as LinkIcon, ExternalLink, PlusCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, doc, query, orderBy } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";

interface Material {
    id: string;
    name: string;
    size: string;
    uploadDate: string; // Should be Firestore Timestamp in a real app
    url: string;
}

interface ExternalLink {
    id: string;
    title: string;
    url: string;
    description: string;
}

export default function ClassMaterialsPage() {
    const params = useParams();
    const classId = params.classId as string;
    const { user: currentUser } = useAuth();
    
    const [materials, setMaterials] = useState<Material[]>([]);
    const [links, setLinks] = useState<ExternalLink[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isHost, setIsHost] = useState(false);

    useEffect(() => {
        if (!classId || !currentUser) return;
        
        const unsubs: (() => void)[] = [];

        // Check if user is the host
        unsubs.push(onSnapshot(doc(db, "classes", classId), (docSnap) => {
            if (docSnap.exists()) {
                setIsHost(docSnap.data().creatorId === currentUser.uid);
            }
        }));

        // Fetch materials
        const materialsQuery = query(collection(db, "classes", classId, "materials"), orderBy("uploadDate", "desc"));
        unsubs.push(onSnapshot(materialsQuery, (snapshot) => {
            const fetchedMaterials: Material[] = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                fetchedMaterials.push({ 
                    id: doc.id, 
                    ...data,
                    uploadDate: data.uploadDate?.toDate().toLocaleDateString() || new Date().toLocaleDateString() 
                } as Material);
            });
            setMaterials(fetchedMaterials);
            setIsLoading(false);
        }));

        // Fetch links
        const linksQuery = query(collection(db, "classes", classId, "links"), orderBy("createdAt", "desc"));
        unsubs.push(onSnapshot(linksQuery, (snapshot) => {
            const fetchedLinks: ExternalLink[] = [];
            snapshot.forEach(doc => fetchedLinks.push({ id: doc.id, ...doc.data() } as ExternalLink));
            setLinks(fetchedLinks);
        }));

        return () => unsubs.forEach(unsub => unsub());

    }, [classId, currentUser]);


    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Class Materials</h1>
                    <p className="text-muted-foreground">Find all your course documents, links, and lecture notes here.</p>
                </div>
                 <Button asChild variant="outline" className="rounded-lg">
                    <Link href={`/dashboard/class/${classId}`}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Class</Link>
                </Button>
            </div>
            <Tabs defaultValue="files" className="w-full">
                <Card className="rounded-xl shadow-lg border-border/50">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle>Course Resources</CardTitle>
                                <CardDescription>Access uploaded files and important links for this class.</CardDescription>
                            </div>
                            <TabsList className="grid w-full grid-cols-2 max-w-[200px] rounded-lg">
                                <TabsTrigger value="files" className="rounded-md">Files</TabsTrigger>
                                <TabsTrigger value="links" className="rounded-md">Links</TabsTrigger>
                            </TabsList>
                        </div>
                    </CardHeader>

                    <TabsContent value="files">
                        <CardContent>
                            {isLoading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-20 w-full" />
                                    <Skeleton className="h-20 w-full" />
                                </div>
                            ) : materials.length > 0 ? (
                                <div className="space-y-3">
                                    {materials.map(material => (
                                        <div key={material.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                                            <div className="flex items-center gap-4">
                                                <FileText className="h-6 w-6 text-primary" />
                                                <div>
                                                    <p className="font-semibold">{material.name}</p>
                                                    <p className="text-sm text-muted-foreground">Uploaded: {material.uploadDate} | Size: {material.size}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button asChild variant="outline" size="icon" className="rounded-lg"><a href={material.url} target="_blank" rel="noopener noreferrer"><Eye className="h-4 w-4" /></a></Button>
                                                <Button asChild variant="outline" size="icon" className="rounded-lg"><a href={material.url} download={material.name}><Download className="h-4 w-4" /></a></Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-10 text-muted-foreground"><FileText className="mx-auto h-12 w-12 mb-2" /><p>No files have been uploaded yet.</p></div>
                            )}
                        </CardContent>
                        {isHost && (
                            <CardFooter>
                                <Button className="w-full btn-gel rounded-lg" disabled>
                                    <UploadCloud className="mr-2 h-4 w-4" /> Upload New Material (Coming Soon)
                                </Button>
                            </CardFooter>
                        )}
                    </TabsContent>

                    <TabsContent value="links">
                        <CardContent>
                             {isLoading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-20 w-full" />
                                    <Skeleton className="h-20 w-full" />
                                </div>
                            ) : links.length > 0 ? (
                                <div className="space-y-3">
                                    {links.map(link => (
                                        <div key={link.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                                            <div className="flex items-center gap-4 min-w-0">
                                                <LinkIcon className="h-6 w-6 text-primary flex-shrink-0" />
                                                <div className="min-w-0">
                                                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline truncate block" title={link.url}>{link.title}</a>
                                                    <p className="text-sm text-muted-foreground truncate">{link.description}</p>
                                                </div>
                                            </div>
                                            <Button asChild variant="outline" size="icon" className="rounded-lg flex-shrink-0 ml-2">
                                                <a href={link.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                             ) : (
                                <div className="text-center py-10 text-muted-foreground">
                                    <LinkIcon className="mx-auto h-12 w-12 mb-2" /><p>No links have been added yet.</p>
                                </div>
                             )}
                        </CardContent>
                        {isHost && (
                            <CardFooter>
                                <Button className="w-full btn-gel rounded-lg" disabled>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Add New Link (Coming Soon)
                                </Button>
                            </CardFooter>
                        )}
                    </TabsContent>
                </Card>
            </Tabs>
        </div>
    );
}
