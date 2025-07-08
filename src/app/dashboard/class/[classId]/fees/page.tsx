
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CreditCard, BadgeCheck, CircleAlert } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function ClassFeesPage() {
    const params = useParams();
    const classId = params.classId as string;
    const { toast } = useToast();

    // Mock fee status. In a real app, this would be fetched.
    const feeStatus = "Due"; // Can be 'Paid' or 'Due'
    const feeAmount = "150.00";

    const handlePayment = () => {
        // Mock payment processing
        toast({
            title: "Payment Submitted",
            description: `Your payment of $${feeAmount} has been processed successfully.`,
        });
        // In a real app, you would update the fee status here.
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Class Fees</h1>
                    <p className="text-muted-foreground">Manage and pay your class fees.</p>
                </div>
                <Button asChild variant="outline" className="rounded-lg">
                    <Link href={`/dashboard/class/${classId}`}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Class
                    </Link>
                </Button>
            </div>

            <Card className="rounded-xl shadow-lg border-border/50">
                <CardHeader>
                    <CardTitle>Fee Status</CardTitle>
                    <CardDescription>Your current fee status for this class.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                        <div className="font-semibold text-lg">
                            Total Due: ${feeAmount}
                        </div>
                        {feeStatus === "Paid" ? (
                            <Badge variant="default" className="text-base py-1 px-3 bg-green-600">
                                <BadgeCheck className="mr-2 h-5 w-5"/> Paid
                            </Badge>
                        ) : (
                            <Badge variant="destructive" className="text-base py-1 px-3">
                                <CircleAlert className="mr-2 h-5 w-5"/> Due
                            </Badge>
                        )}
                    </div>
                </CardContent>
            </Card>

            {feeStatus === "Due" && (
                <Card className="rounded-xl shadow-lg border-border/50">
                    <CardHeader>
                        <CardTitle>Payment Details</CardTitle>
                        <CardDescription>Enter your payment information below. This is a mock form.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="cardName">Cardholder Name</Label>
                            <Input id="cardName" placeholder="John M. Doe" className="rounded-lg" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cardNumber">Card Number</Label>
                            <div className="relative">
                                <CreditCard className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                                <Input id="cardNumber" placeholder="**** **** **** 1234" className="rounded-lg pl-10" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="expiryDate">Expiry Date</Label>
                                <Input id="expiryDate" placeholder="MM/YY" className="rounded-lg" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cvc">CVC</Label>
                                <Input id="cvc" placeholder="123" className="rounded-lg" />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handlePayment} className="w-full btn-gel rounded-lg">
                            Pay ${feeAmount} Now
                        </Button>
                    </CardFooter>
                </Card>
            )}
        </div>
    );
}
