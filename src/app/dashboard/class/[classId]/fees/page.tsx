
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CreditCard, BadgeCheck, CircleAlert, Edit, Save, X, QrCode, Landmark, WalletCards, Info } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// In a real app, this ID would come from the class data.
const mockTeacherId = "teacher-evelyn-reed-uid";

export default function ClassFeesPage() {
    const params = useParams();
    const classId = params.classId as string;
    const { toast } = useToast();
    const { user: currentUser } = useAuth();

    // Check if the current user is the host/teacher.
    const isHost = currentUser?.uid === mockTeacherId;

    // Mock fee status and details, now using state for dynamic updates.
    const [feeStatus, setFeeStatus] = useState<'Paid' | 'Due'>("Due");
    const [feeAmount, setFeeAmount] = useState<string>("150.00");
    const [currency, setCurrency] = useState<string>("$");

    // State for editing fee details
    const [isEditing, setIsEditing] = useState(false);
    const [editAmount, setEditAmount] = useState(feeAmount);
    const [editCurrency, setEditCurrency] = useState(currency);

    const handlePayment = () => {
        // Mock payment processing
        toast({
            title: "Payment Submitted",
            description: `Your payment of ${currency}${feeAmount} has been processed successfully.`,
        });
        // In a real app, you would update the fee status here.
        setFeeStatus("Paid");
    };

    const handleSaveFeeDetails = () => {
        if (!editAmount || isNaN(Number(editAmount)) || Number(editAmount) < 0) {
            toast({ variant: "destructive", title: "Invalid Amount", description: "Please enter a valid, non-negative number for the fee." });
            return;
        }
        setFeeAmount(Number(editAmount).toFixed(2));
        setCurrency(editCurrency);
        setIsEditing(false);
        toast({ title: "Fee Details Updated", description: "The class fee has been successfully updated." });
    };

    const handleCancelEdit = () => {
        setEditAmount(feeAmount);
        setEditCurrency(currency);
        setIsEditing(false);
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

            <Alert className="bg-primary/5 border-primary/20">
                <Info className="h-4 w-4" />
                <AlertTitle className="text-primary font-semibold">Platform Fee Notice</AlertTitle>
                <AlertDescription>
                    Please be aware that a 2% platform fee is applied to all class fee transactions to support the development and maintenance of TeachMeet. This fee is automatically calculated during payment.
                </AlertDescription>
            </Alert>

            <Card className="rounded-xl shadow-lg border-border/50">
                <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                        <CardTitle>Fee Status</CardTitle>
                        <CardDescription>Your current fee status for this class.</CardDescription>
                    </div>
                    {isHost && !isEditing && (
                        <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setIsEditing(true)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit Fee
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    {isEditing ? (
                        <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                             <h3 className="text-lg font-semibold">Edit Fee Details</h3>
                             <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="sm:col-span-2">
                                    <Label htmlFor="feeAmount">Amount</Label>
                                    <Input 
                                        id="feeAmount"
                                        type="number"
                                        value={editAmount}
                                        onChange={(e) => setEditAmount(e.target.value)}
                                        placeholder="e.g., 150.00"
                                        className="mt-1 rounded-lg"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="feeCurrency">Currency</Label>
                                    <Select value={editCurrency} onValueChange={setEditCurrency}>
                                        <SelectTrigger id="feeCurrency" className="mt-1 rounded-lg">
                                            <SelectValue placeholder="Select Currency" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-lg">
                                            <SelectItem value="$" className="rounded-md">USD ($)</SelectItem>
                                            <SelectItem value="₹" className="rounded-md">INR (₹)</SelectItem>
                                            <SelectItem value="£" className="rounded-md">GBP (£)</SelectItem>
                                            <SelectItem value="€" className="rounded-md">EUR (€)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                             </div>
                             <div className="flex justify-end gap-2 mt-2">
                                <Button variant="ghost" size="sm" className="rounded-lg" onClick={handleCancelEdit}>
                                    <X className="mr-2 h-4 w-4" /> Cancel
                                </Button>
                                <Button size="sm" className="rounded-lg btn-gel" onClick={handleSaveFeeDetails}>
                                    <Save className="mr-2 h-4 w-4" /> Save
                                </Button>
                             </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                            <div className="font-semibold text-lg">
                                Total Due: {currency}{feeAmount}
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
                    )}
                </CardContent>
            </Card>

            {!isHost && feeStatus === "Due" && (
                <Card className="rounded-xl shadow-lg border-border/50">
                    <CardHeader>
                        <CardTitle>Make Payment</CardTitle>
                        <CardDescription>Choose your preferred payment method. This is a mock form.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="card" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 rounded-lg">
                                <TabsTrigger value="card" className="rounded-md"><CreditCard className="mr-2 h-4 w-4" /> Card</TabsTrigger>
                                <TabsTrigger value="upi" className="rounded-md"><WalletCards className="mr-2 h-4 w-4" /> UPI</TabsTrigger>
                                <TabsTrigger value="netbanking" className="rounded-md"><Landmark className="mr-2 h-4 w-4" /> Net Banking</TabsTrigger>
                                <TabsTrigger value="qrcode" className="rounded-md"><QrCode className="mr-2 h-4 w-4" /> QR Code</TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="card" className="mt-6">
                                <div className="space-y-4">
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
                                     <Button onClick={handlePayment} className="w-full btn-gel rounded-lg pt-4">
                                        Pay {currency}{feeAmount} Now
                                    </Button>
                                </div>
                            </TabsContent>

                            <TabsContent value="upi" className="mt-6">
                                <div className="space-y-4">
                                     <div className="space-y-2">
                                        <Label htmlFor="upiId">UPI ID</Label>
                                        <Input id="upiId" placeholder="yourname@bank" className="rounded-lg" />
                                     </div>
                                     <Button onClick={handlePayment} className="w-full btn-gel rounded-lg">
                                        Pay {currency}{feeAmount} with UPI
                                    </Button>
                                </div>
                            </TabsContent>

                            <TabsContent value="netbanking" className="mt-6">
                                <div className="space-y-4">
                                     <div className="space-y-2">
                                        <Label htmlFor="bankSelect">Select Bank</Label>
                                        <Select>
                                            <SelectTrigger id="bankSelect" className="rounded-lg">
                                                <SelectValue placeholder="Choose your bank" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-lg">
                                                <SelectItem value="bank1" className="rounded-md">Bank of Example</SelectItem>
                                                <SelectItem value="bank2" className="rounded-md">Global Trust Bank</SelectItem>
                                                <SelectItem value="bank3" className="rounded-md">National Mock Bank</SelectItem>
                                                <SelectItem value="bank4" className="rounded-md">Commerce Mock Bank</SelectItem>
                                            </SelectContent>
                                        </Select>
                                     </div>
                                     <Button onClick={handlePayment} className="w-full btn-gel rounded-lg">
                                        Proceed to Bank
                                    </Button>
                                </div>
                            </TabsContent>
                            
                            <TabsContent value="qrcode" className="mt-6">
                                <div className="flex flex-col items-center space-y-4">
                                    <div className="p-4 bg-white rounded-lg border">
                                       <img src="https://placehold.co/200x200.png" alt="QR Code" data-ai-hint="qr code" />
                                    </div>
                                    <p className="text-sm text-muted-foreground">Scan the QR code with any UPI app.</p>
                                     <Button onClick={handlePayment} className="w-full btn-gel rounded-lg">
                                        I have paid
                                    </Button>
                                </div>
                            </TabsContent>

                        </Tabs>
                    </CardContent>
                     <CardFooter>
                        <p className="text-xs text-muted-foreground text-center w-full">
                            All transactions are placeholders and no real payment will be processed.
                        </p>
                    </CardFooter>
                </Card>
            )}
        </div>
    );
}
