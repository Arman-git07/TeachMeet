
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CreditCard, BadgeCheck, CircleAlert, Edit, Save, X, QrCode, Landmark, WalletCards, Info, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";

interface FeeData {
    amount?: string;
    currency?: string;
    status?: 'Paid' | 'Due';
}

interface ClassData {
    creatorId?: string;
    fee?: FeeData;
}

export default function ClassFeesPage() {
    const params = useParams();
    const classId = params.classId as string;
    const { toast } = useToast();
    const { user: currentUser } = useAuth();
    
    const [classData, setClassData] = useState<ClassData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isHost, setIsHost] = useState(false);

    // Editing state
    const [isEditing, setIsEditing] = useState(false);
    const [editAmount, setEditAmount] = useState("0.00");
    const [editCurrency, setEditCurrency] = useState("$");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!classId) return;
        const classDocRef = doc(db, "classes", classId);
        const unsubscribe = onSnapshot(classDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as ClassData;
                setClassData(data);
                setIsHost(data.creatorId === currentUser?.uid);
                setEditAmount(data.fee?.amount || "0.00");
                setEditCurrency(data.fee?.currency || "$");
            } else {
                toast({ variant: 'destructive', title: 'Error', description: 'Class not found.' });
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [classId, currentUser?.uid, toast]);
    
    const feeStatus = classData?.fee?.status || 'Due';
    const feeAmount = classData?.fee?.amount || '0.00';
    const currency = classData?.fee?.currency || '$';

    const handlePayment = () => {
        toast({
            title: "Payment Submitted",
            description: `Your payment of ${currency}${feeAmount} has been processed successfully. (This is a simulation)`,
        });
        const classDocRef = doc(db, "classes", classId);
        updateDoc(classDocRef, { "fee.status": "Paid" });
    };

    const handleSaveFeeDetails = async () => {
        if (!editAmount || isNaN(Number(editAmount)) || Number(editAmount) < 0) {
            toast({ variant: "destructive", title: "Invalid Amount", description: "Please enter a valid, non-negative number for the fee." });
            return;
        }
        setIsSaving(true);
        const classDocRef = doc(db, "classes", classId);
        try {
            await updateDoc(classDocRef, {
                "fee.amount": Number(editAmount).toFixed(2),
                "fee.currency": editCurrency
            });
            setIsEditing(false);
            toast({ title: "Fee Details Updated", description: "The class fee has been successfully updated." });
        } catch (error) {
             console.error("Error saving fee details:", error);
             toast({ variant: "destructive", title: "Save Failed", description: "Could not update fee details." });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleCancelEdit = () => {
        setEditAmount(feeAmount);
        setEditCurrency(currency);
        setIsEditing(false);
    };
    
    if (isLoading) {
        return <div className="space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-48 w-full" /><Skeleton className="h-64 w-full" /></div>;
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Class Fees</h1>
                    <p className="text-muted-foreground">Manage and pay your class fees.</p>
                </div>
                <Button asChild variant="outline" className="rounded-lg">
                    <Link href={`/dashboard/class/${classId}`}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Class</Link>
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
                        <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setIsEditing(true)}><Edit className="mr-2 h-4 w-4" /> Edit Fee</Button>
                    )}
                </CardHeader>
                <CardContent>
                    {isEditing ? (
                        <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                             <h3 className="text-lg font-semibold">Edit Fee Details</h3>
                             <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="sm:col-span-2">
                                    <Label htmlFor="feeAmount">Amount</Label>
                                    <Input id="feeAmount" type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} placeholder="e.g., 150.00" className="mt-1 rounded-lg" disabled={isSaving}/>
                                </div>
                                <div>
                                    <Label htmlFor="feeCurrency">Currency</Label>
                                    <Select value={editCurrency} onValueChange={setEditCurrency} disabled={isSaving}>
                                        <SelectTrigger id="feeCurrency" className="mt-1 rounded-lg"><SelectValue placeholder="Select Currency" /></SelectTrigger>
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
                                <Button variant="ghost" size="sm" className="rounded-lg" onClick={handleCancelEdit} disabled={isSaving}><X className="mr-2 h-4 w-4" /> Cancel</Button>
                                <Button size="sm" className="rounded-lg btn-gel" onClick={handleSaveFeeDetails} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    {isSaving ? 'Saving...' : 'Save'}
                                </Button>
                             </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                            <div className="font-semibold text-lg">Total Due: {currency}{feeAmount}</div>
                            {feeStatus === "Paid" ? (
                                <Badge variant="default" className="text-base py-1 px-3 bg-green-600"><BadgeCheck className="mr-2 h-5 w-5"/> Paid</Badge>
                            ) : (
                                <Badge variant="destructive" className="text-base py-1 px-3"><CircleAlert className="mr-2 h-5 w-5"/> Due</Badge>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {!isHost && feeStatus === "Due" && (
                <Card className="rounded-xl shadow-lg border-border/50">
                    <CardHeader>
                        <CardTitle>Make Payment</CardTitle>
                        <CardDescription>Choose your preferred payment method. This is a simulation.</CardDescription>
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
                                    <div className="space-y-2"><Label htmlFor="paymentAmountCard">Amount to Pay</Label><Input id="paymentAmountCard" value={`${currency}${feeAmount}`} className="rounded-lg font-semibold bg-muted/80" readOnly /></div>
                                    <div className="space-y-2"><Label htmlFor="cardName">Cardholder Name</Label><Input id="cardName" placeholder="John M. Doe" className="rounded-lg" /></div>
                                    <div className="space-y-2">
                                        <Label htmlFor="cardNumber">Card Number</Label>
                                        <div className="relative">
                                            <CreditCard className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                                            <Input id="cardNumber" placeholder="**** **** **** 1234" className="rounded-lg pl-10" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2"><Label htmlFor="expiryDate">Expiry Date</Label><Input id="expiryDate" placeholder="MM/YY" className="rounded-lg" /></div>
                                        <div className="space-y-2"><Label htmlFor="cvc">CVC</Label><Input id="cvc" placeholder="123" className="rounded-lg" /></div>
                                    </div>
                                     <Button onClick={handlePayment} className="w-full btn-gel rounded-lg py-3">Pay {currency}{feeAmount} Now</Button>
                                </div>
                            </TabsContent>
                            <TabsContent value="upi" className="mt-6"><div className="space-y-4"><div className="space-y-2"><Label htmlFor="paymentAmountUpi">Amount to Pay</Label><Input id="paymentAmountUpi" value={`${currency}${feeAmount}`} className="rounded-lg font-semibold bg-muted/80" readOnly /></div><div className="space-y-2"><Label htmlFor="upiId">UPI ID</Label><Input id="upiId" placeholder="yourname@bank" className="rounded-lg" /></div><Button onClick={handlePayment} className="w-full btn-gel rounded-lg">Pay {currency}{feeAmount} with UPI</Button></div></TabsContent>
                            <TabsContent value="netbanking" className="mt-6"><div className="space-y-4"><div className="space-y-2"><Label htmlFor="paymentAmountNetBanking">Amount to Pay</Label><Input id="paymentAmountNetBanking" value={`${currency}${feeAmount}`} className="rounded-lg font-semibold bg-muted/80" readOnly /></div><div className="space-y-2"><Label htmlFor="bankSelect">Select Bank</Label><Select><SelectTrigger id="bankSelect" className="rounded-lg"><SelectValue placeholder="Choose your bank" /></SelectTrigger><SelectContent className="rounded-lg"><SelectItem value="bank1" className="rounded-md">Bank of Example</SelectItem><SelectItem value="bank2" className="rounded-md">Global Trust Bank</SelectItem><SelectItem value="bank3" className="rounded-md">National Mock Bank</SelectItem><SelectItem value="bank4" className="rounded-md">Commerce Mock Bank</SelectItem></SelectContent></Select></div><Button onClick={handlePayment} className="w-full btn-gel rounded-lg">Proceed to Bank</Button></div></TabsContent>
                            <TabsContent value="qrcode" className="mt-6"><div className="flex flex-col items-center space-y-4"><div className="text-center"><p className="text-sm text-muted-foreground">Amount to Pay</p><p className="text-2xl font-bold text-foreground">{currency}{feeAmount}</p></div><div className="p-4 bg-white rounded-lg border"><img src="https://placehold.co/200x200.png" alt="QR Code" data-ai-hint="qr code" /></div><p className="text-sm text-muted-foreground">Scan the QR code with any UPI app.</p><Button onClick={handlePayment} className="w-full btn-gel rounded-lg">I have paid</Button></div></TabsContent>
                        </Tabs>
                    </CardContent>
                     <CardFooter><p className="text-xs text-muted-foreground text-center w-full">All transactions are simulated and no real payment will be processed.</p></CardFooter>
                </Card>
            )}
        </div>
    );
}
