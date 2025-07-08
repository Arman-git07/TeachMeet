
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, UploadCloud, ArrowLeft, Download, Eye, Link as LinkIcon, ExternalLink, PlusCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const mockMaterials = [
    { id: 'syllabus', name: 'Course Syllabus.pdf', size: '1.2MB', uploadDate: '2024-08-20' },
    { id: 'lecture1', name: 'Lecture 1 - Introduction.pptx', size: '5.8MB', uploadDate: '2024-08-22' },
    { id: 'reading1', name: 'Required Reading Ch 1-3.pdf', size: '3.4MB', uploadDate: '2024-08-22' },
];

const mockLinks = [
    { id: 'link1', title: 'Khan Academy - Algebra Basics', url: 'https://www.khanacademy.org/math/algebra-basics', description: 'Great for fundamentals.' },
    { id: 'link2', title: '3Blue1Brown - Essence of Linear Algebra', url: 'https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab', description: 'Visual explanations of core concepts.' },
    { id: 'link3', title: 'Paul\'s Online Math Notes', url: 'https://tutorial.math.lamar.edu/', description: 'Detailed notes and examples.' },
];


// In a real app, this ID would come from the class data.
// We use a mock ID here to simulate role-based access.
const mockTeacherId = "teacher-evelyn-reed-uid";

export default function ClassMaterialsPage() {
    const params = useParams();
    const classId = params.classId as string;
    const { user: currentUser } = useAuth();

    // Check if the current user is the host/teacher.
    const isHost = currentUser?.uid === mockTeacherId;

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Class Materials</h1>
                    <p className="text-muted-foreground">Find all your course documents, links, and lecture notes here.</p>
                </div>
                 <Button asChild variant="outline" className="rounded-lg">
                    <Link href={`/dashboard/class/${classId}`}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Class
                    </Link>
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
                            <div className="space-y-3">
                                {mockMaterials.map(material => (
                                    <div key={material.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                                        <div className="flex items-center gap-4">
                                            <FileText className="h-6 w-6 text-primary" />
                                            <div>
                                                <p className="font-semibold">{material.name}</p>
                                                <p className="text-sm text-muted-foreground">Uploaded: {material.uploadDate} | Size: {material.size}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="icon" className="rounded-lg">
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button variant="outline" size="icon" className="rounded-lg">
                                                <Download className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                        {isHost && (
                            <CardFooter>
                                <Button className="w-full btn-gel rounded-lg">
                                    <UploadCloud className="mr-2 h-4 w-4" /> Upload New Material
                                </Button>
                            </CardFooter>
                        )}
                    </TabsContent>

                    <TabsContent value="links">
                        <CardContent>
                             {mockLinks.length > 0 ? (
                                <div className="space-y-3">
                                    {mockLinks.map(link => (
                                        <div key={link.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                                            <div className="flex items-center gap-4 min-w-0">
                                                <LinkIcon className="h-6 w-6 text-primary flex-shrink-0" />
                                                <div className="min-w-0">
                                                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline truncate block" title={link.url}>{link.title}</a>
                                                    <p className="text-sm text-muted-foreground truncate">{link.description}</p>
                                                </div>
                                            </div>
                                            <Button asChild variant="outline" size="icon" className="rounded-lg flex-shrink-0 ml-2">
                                                <a href={link.url} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink className="h-4 w-4" />
                                                </a>
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                             ) : (
                                <div className="text-center py-10 text-muted-foreground">
                                    <LinkIcon className="mx-auto h-12 w-12 mb-2" />
                                    <p>No links have been added yet.</p>
                                </div>
                             )}
                        </CardContent>
                        {isHost && (
                            <CardFooter>
                                <Button className="w-full btn-gel rounded-lg">
                                    <PlusCircle className="mr-2 h-4 w-4" /> Add New Link
                                </Button>
                            </CardFooter>
                        )}
                    </TabsContent>
                </Card>
            </Tabs>
        </div>
    );
}
