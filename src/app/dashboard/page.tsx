import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Video, Users, Settings, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function DashboardPage() {
  const userName = "User"; // Replace with actual user name from auth

  const quickActions = [
    { name: "Start New Meeting", icon: PlusCircle, href: "/dashboard/start-meeting", color: "bg-primary hover:bg-primary/90" },
    { name: "Join Meeting", icon: Video, href: "/dashboard/join-meeting", color: "bg-accent text-accent-foreground hover:bg-accent/90" },
    { name: "My Meetings", icon: Users, href: "/dashboard/meetings", color: "bg-secondary hover:bg-secondary/90" },
  ];

  const resources = [
    { name: "Settings", icon: Settings, href: "/dashboard/settings" },
    { name: "Help & Support", icon: HelpCircle, href: "/dashboard/help" },
  ];

  return (
    <div className="space-y-8">
      <Card className="shadow-xl border-border/50 rounded-xl overflow-hidden">
        <div className="relative h-48 md:h-64 w-full">
          <Image 
            src="https://placehold.co/1200x400.png" 
            alt="Abstract Meeting Background" 
            layout="fill" 
            objectFit="cover"
            data-ai-hint="abstract meeting"
            className="opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent p-6 md:p-8 flex flex-col justify-end">
            <h1 className="text-3xl md:text-4xl font-bold text-primary-foreground">Welcome back, {userName}!</h1>
            <p className="text-lg text-primary-foreground/80 mt-1">Ready to connect and collaborate?</p>
          </div>
        </div>
      </Card>

      <section>
        <h2 className="text-2xl font-semibold mb-4 text-foreground">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quickActions.map(action => (
            <Link href={action.href} key={action.name} passHref legacyBehavior>
              <Card className="hover:shadow-lg transition-shadow duration-300 rounded-xl cursor-pointer group">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-medium text-foreground">{action.name}</CardTitle>
                  <action.icon className={`h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors ${action.name === "Join Meeting" ? "group-hover:text-accent" : ""}`} />
                </CardHeader>
                <CardContent>
                  <Button className={`w-full mt-2 btn-gel rounded-lg ${action.color}`}>
                    {action.name}
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4 text-foreground">Ongoing Meetings</h2>
        <Card className="rounded-xl">
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground py-8">
              <Video className="mx-auto h-12 w-12 mb-2" />
              <p>No active meetings right now.</p>
              <p className="text-sm">Your ongoing meetings will appear here.</p>
            </div>
          </CardContent>
        </Card>
      </section>
      
      <section>
        <h2 className="text-2xl font-semibold mb-4 text-foreground">Resources</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {resources.map(resource => (
             <Link href={resource.href} key={resource.name} passHref legacyBehavior>
             <Card className="hover:shadow-lg transition-shadow duration-300 rounded-xl cursor-pointer group">
               <CardContent className="pt-6 flex items-center gap-4">
                 <div className={`p-3 rounded-lg ${resource.name === "Settings" ? "bg-secondary" : "bg-accent"}`}>
                    <resource.icon className={`h-6 w-6 ${resource.name === "Settings" ? "text-secondary-foreground" : "text-accent-foreground"}`} />
                 </div>
                 <div>
                    <h3 className="text-lg font-medium text-foreground">{resource.name}</h3>
                    <p className="text-sm text-muted-foreground">Access your {resource.name.toLowerCase()}.</p>
                 </div>
               </CardContent>
             </Card>
           </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
