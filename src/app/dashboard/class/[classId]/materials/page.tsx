
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, FileText, ArrowLeft, UploadCloud, Link as LinkIcon, Download, Trash2, FolderOpen } from "lucide-react";
import Link from 'next/link';
import { use } from "react";

interface Material {
  id: string;
  type: 'file' | 'link';
  title: string;
  description: string;
  url?: string; // For links or file download URLs
  fileName?: string;
  fileSize?: string;
}

// Mock data
const mockMaterials: Material[] = [
  { id: 'm1', type: 'file', title: 'Syllabus Fall 2024', description: 'The official course syllabus.', fileName: 'syllabus_f24.pdf', fileSize: '1.2MB' },
  { id: 'm2', type: 'link', title: 'Photosynthesis Explained (Video)', description: 'Helpful YouTube video on the topic.', url: 'https://www.youtube.com' },
  { id: 'm3', type: 'file', title: 'Chapter 1 Slides', description: 'Lecture slides for the first chapter.', fileName: 'chapter1_slides.pptx', fileSize: '5.8MB' },
  { id: 'm4', type: 'link', title: 'Biology Online Textbook', description: 'The recommended online resource for this course.', url: 'https://www.example.com' },
];


export default function ClassMaterialsPage({ params: paramsPromise }: { params: Promise<{ classId: string }> }) {
    const { classId } = use(paramsPromise);

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Link href="/dashboard/classes" className="text-primary hover:underline text-sm">Classes</Link>
                        <span className="text-sm text-muted-foreground">/</span>
                        <span className="text-sm text-muted-foreground">Class {classId}</span>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Class Materials</h1>
                    <p className="text-muted-foreground">View and manage learning materials for this class.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="rounded-lg">
                        <LinkIcon className="mr-2 h-5 w-5" /> Add Link
                    </Button>
                    <Button className="btn-gel rounded-lg">
                        <UploadCloud className="mr-2 h-5 w-5" /> Upload File
                    </Button>
                </div>
            </div>

            {mockMaterials.length === 0 ? (
                <Card className="text-center py-12 rounded-xl shadow-lg border-border/50">
                    <CardHeader>
                        <FolderOpen className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                        <CardTitle className="text-2xl">No Materials Yet</CardTitle>
                        <CardDescription>Upload files or add links to share with your class.</CardDescription>
                    </CardHeader>
                </Card>
            ) : (
                 <div className="space-y-4">
                    {mockMaterials.map(material => (
                        <Card key={material.id} className="rounded-xl shadow-md hover:shadow-lg transition-shadow border-border/50">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                     <div className="p-3 bg-muted rounded-lg">
                                        {material.type === 'file' ? <FileText className="h-6 w-6 text-primary" /> : <LinkIcon className="h-6 w-6 text-accent" />}
                                     </div>
                                     <div>
                                        <h3 className="font-semibold text-foreground">{material.title}</h3>
                                        <p className="text-sm text-muted-foreground">{material.description}</p>
                                        {material.type === 'file' && <p className="text-xs text-muted-foreground">{material.fileName} ({material.fileSize})</p>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                     {material.type === 'file' ? (
                                        <Button variant="outline" size="sm" className="rounded-lg">
                                            <Download className="mr-2 h-4 w-4" /> Download
                                        </Button>
                                     ) : (
                                        <a href={material.url} target="_blank" rel="noopener noreferrer">
                                            <Button variant="outline" size="sm" className="rounded-lg">
                                                Open Link
                                            </Button>
                                        </a>
                                     )}
                                     <Button variant="ghost" size="icon" className="text-destructive rounded-full h-8 w-8">
                                         <Trash2 className="h-4 w-4" />
                                     </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
