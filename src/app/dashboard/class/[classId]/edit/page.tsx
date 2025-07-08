
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export default function EditClassPage() {
    const params = useParams();
    const classId = params.classId as string;
    const { toast } = useToast();

    const handleSaveChanges = () => {
        toast({
            title: "Changes Saved",
            description: "Your class details have been updated.",
        });
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Edit Class Details</h1>
                    <p className="text-muted-foreground">Modify the settings for your class.</p>
                </div>
                <Button asChild variant="outline" className="rounded-lg">
                    <Link href={`/dashboard/class/${classId}`}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Class
                    </Link>
                </Button>
            </div>

            <Card className="rounded-xl shadow-lg border-border/50">
                <CardHeader>
                    <CardTitle>Class Information</CardTitle>
                    <CardDescription>Update the name and description of your class.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div>
                        <Label htmlFor="className">Class Name</Label>
                        <Input id="className" defaultValue="Algebra 101" className="mt-1 rounded-lg" />
                     </div>
                     <div>
                        <Label htmlFor="classDescription">Class Description</Label>
                        <Textarea id="classDescription" defaultValue="Fundamentals of algebra and problem solving." className="mt-1 rounded-lg" rows={4} />
                     </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSaveChanges} className="btn-gel rounded-lg">
                        <Save className="mr-2 h-4 w-4"/> Save Changes
                    </Button>
                </CardFooter>
            </Card>

            <Card className="rounded-xl shadow-lg border-destructive/50">
                <CardHeader>
                    <CardTitle className="text-destructive">Danger Zone</CardTitle>
                    <CardDescription>These actions are permanent and cannot be undone.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button variant="destructive" className="w-full rounded-lg">
                        <Trash2 className="mr-2 h-4 w-4"/> Delete This Class
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
