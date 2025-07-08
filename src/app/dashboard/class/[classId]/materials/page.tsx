
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, UploadCloud, ArrowLeft, Download, Eye } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const mockMaterials = [
    { id: 'syllabus', name: 'Course Syllabus.pdf', size: '1.2MB', uploadDate: '2024-08-20' },
    { id: 'lecture1', name: 'Lecture 1 - Introduction.pptx', size: '5.8MB', uploadDate: '2024-08-22' },
    { id: 'reading1', name: 'Required Reading Ch 1-3.pdf', size: '3.4MB', uploadDate: '2024-08-22' },
];

// Reusing the mock teacher ID from the class home page for consistency.
const mockTeacherId = "teacher-evelyn-reed-uid";

export default function ClassMaterialsPage() {
    const params = useParams();
    const classId = params.classId as string;
    const { user: currentUser } = useAuth();

    // Determine if the current user is the host/teacher.
    const isHost = currentUser?.uid === mockTeacherId;

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Class Materials</h1>
                    <p className="text-muted-foreground">Find all your course documents and lecture notes here.</p>
                </div>
                 <Button asChild variant="outline" className="rounded-lg">
                    <Link href={`/dashboard/class/${classId}`}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Class
                    </Link>
                </Button>
            </div>

            <Card className="rounded-xl shadow-lg border-border/50">
                <CardHeader>
                    <CardTitle>Uploaded Files</CardTitle>
                    <CardDescription>All materials uploaded by the instructor for this class.</CardDescription>
                </CardHeader>
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
                {/* Conditionally render the footer with the upload button for the host */}
                {isHost && (
                    <CardFooter>
                        <Button className="w-full btn-gel rounded-lg">
                            <UploadCloud className="mr-2 h-4 w-4" /> Upload New Material
                        </Button>
                    </CardFooter>
                )}
            </Card>
        </div>
    );
}
