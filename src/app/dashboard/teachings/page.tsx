
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { School } from "lucide-react";

export default function TeachingsPage() {
  return (
    <div className="container mx-auto flex flex-1 flex-col items-center justify-center p-4">
      <Card className="w-full max-w-2xl text-center shadow-xl rounded-xl border-border/50">
        <CardHeader>
          <School className="mx-auto h-12 w-12 text-primary mb-3" />
          <CardTitle className="text-3xl">Teachings</CardTitle>
          <CardDescription>
            This section is under construction.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Exciting new features for teachings and interactive lessons are coming soon. Stay tuned!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
