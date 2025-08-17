

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { db, storage } from '@/lib/firebase';
import { doc, getDoc, onSnapshot, collection, query, writeBatch, addDoc, serverTimestamp, orderBy, deleteDoc, updateDoc, setDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject as deleteFile, getBlob } from 'firebase/storage';
import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  Bell,
  Book,
  ClipboardList,
  GraduationCap,
  CreditCard,
  MessageSquare,
  Users,
  AlertTriangle,
  Check,
  X,
  FileText,
  BadgeDollarSign,
  Send,
  Mic,
  StopCircle,
  Play,
  Trash2,
  Loader2,
  UploadCloud,
  LinkIcon,
  Download,
  PlusCircle,
  ExternalLink,
  CalendarIcon,
  Edit,
  FileUp,
  HelpCircle,
  Clock,
  Sparkles,
  Banknote,
  Landmark,
  Wallet,
  Type,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { gradeAssignment } from '@/ai/flows/grade-assignment-flow';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';


interface Classroom {
  id: string;
  title: string;
  description: string;
  teacherId: string;
  teacherName: string;
  feeAmount?: number;
  feeCurrency?: string;
}

interface JoinRequest {
  id: string;
  studentName: string;
  studentPhotoURL?: string;
  studentId: string;
}

interface Announcement {
    id: string;
    content: string;
    authorName: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    audioURL?: string;
}

interface Material {
  id: string;
  type: 'link' | 'file';
  title: string;
  url: string;
  fileName?: string;
  fileSize?: string;
  createdAt: { seconds: number };
}

type ManualQuestion = {
    id: string;
    type: 'multiple-choice' | 'short-answer';
    questionText: string;
    options?: string[];
    correctAnswer?: string | number; // Index for mcq
};

interface Exam {
  id: string;
  title: string;
  description: string;
  startDate: { seconds: number };
  endDate: { seconds: number };
  status: 'draft' | 'published';
  type: 'file' | 'manual';
  fileURL?: string;
  fileName?: string;
  questions?: ManualQuestion[];
  createdAt: { seconds: number };
}


interface Assignment {
  id: string;
  title: string;
  description: string;
  dueDate: { seconds: number };
  fileURL?: string;
  fileName?: string;
  createdAt: { seconds: number };
}

interface SubjectTeacher {
  id: string; // Corresponds to the userId of the teacher
  name: string;
  photoURL?: string;
  subject: string;
  timings: string;
}

interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhotoURL?: string;
  createdAt: { seconds: number };
}

// --- New Interfaces for Assignment Submissions & Grading ---
interface AssignmentSubmission {
    id: string; // studentId
    studentName: string;
    studentPhotoURL?: string;
    submittedAt: { seconds: number };
    fileURL: string;
    fileName: string;
    grade?: {
        score: number;
        feedback: string;
        gradedAt: { seconds: number };
    }
}

const TeacherDialog = React.memo(({ classroomId, onAction, teacherToEdit }: { classroomId: string; onAction: () => void, teacherToEdit: SubjectTeacher | null }) => {
    const [name, setName] = useState('');
    const [subject, setSubject] = useState('');
    const [timings, setTimings] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (teacherToEdit) {
            setName(teacherToEdit.name);
            setSubject(teacherToEdit.subject);
            setTimings(teacherToEdit.timings);
        } else {
            setName('');
            setSubject('');
            setTimings('');
        }
    }, [teacherToEdit]);

    const handleSubmit = async () => {
        if (!name.trim() || !subject.trim() || !timings.trim()) {
            toast({ variant: 'destructive', title: 'Missing Fields', description: 'All fields are required.' });
            return;
        }

        setIsLoading(true);
        try {
            const teacherData = {
                name: name.trim(),
                subject: subject.trim(),
                timings: timings.trim(),
            };

            if (teacherToEdit) {
                const teacherRef = doc(db, 'classrooms', classroomId, 'teachers', teacherToEdit.id);
                await updateDoc(teacherRef, teacherData);
                toast({ title: 'Teacher Updated', description: `Details for ${name.trim()} have been updated.` });
            } else {
                await addDoc(collection(db, 'classrooms', classroomId, 'teachers'), {
                    ...teacherData,
                    createdAt: serverTimestamp(),
                });
                toast({ title: 'Teacher Added', description: `${name.trim()} has been added to the class.` });
            }
            onAction();

        } catch (error) {
            console.error('Error saving teacher:', error);
            toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the teacher details.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>{teacherToEdit ? 'Edit Teacher' : 'Add New Teacher'}</DialogTitle>
                <DialogDescription>{teacherToEdit ? 'Update details for this teacher.' : 'Fill out the details for the new teacher.'}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" placeholder="e.g., John Doe"/>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="subject" className="text-right">Subject</Label>
                    <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="col-span-3" placeholder="e.g., Physics"/>
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="timings" className="text-right">Timings</Label>
                    <Input id="timings" value={timings} onChange={(e) => setTimings(e.target.value)} className="col-span-3" placeholder="e.g., Mon-Fri, 2-4 PM"/>
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button onClick={handleSubmit} disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : teacherToEdit ? "Save Changes" : "Add Teacher"}
                </Button>
            </DialogFooter>
        </DialogContent>
    );
});
TeacherDialog.displayName = 'TeacherDialog';

const EditFeeDialog = ({ classroom, onFeeUpdated }: { classroom: Classroom; onFeeUpdated: () => void }) => {
    const { toast } = useToast();
    const [amount, setAmount] = useState(classroom.feeAmount ?? 500);
    const [currency, setCurrency] = useState(classroom.feeCurrency ?? 'USD');
    const [isLoading, setIsLoading] = useState(false);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const classroomRef = doc(db, 'classrooms', classroom.id);
            await updateDoc(classroomRef, {
                feeAmount: Number(amount),
                feeCurrency: currency,
            });
            toast({ title: "Fee Updated!", description: "The classroom fee has been successfully changed." });
            onFeeUpdated();
        } catch (error) {
            console.error("Error updating fee:", error);
            toast({ variant: 'destructive', title: "Update Failed", description: "Could not update the fee." });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Classroom Fee</DialogTitle>
                <DialogDescription>Set the tuition fee and currency for this class.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-4 py-4">
                <div className="col-span-2 space-y-2">
                    <Label htmlFor="fee-amount">Amount</Label>
                    <Input id="fee-amount" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} placeholder="e.g., 500" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="fee-currency">Currency</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger id="fee-currency"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                        <SelectItem value="GBP">GBP - British Pound</SelectItem>
                        <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                        <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                        <SelectItem value="CHF">CHF - Swiss Franc</SelectItem>
                        <SelectItem value="CNY">CNY - Chinese Yuan</SelectItem>
                        <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                        <SelectItem value="BRL">BRL - Brazilian Real</SelectItem>
                        <SelectItem value="RUB">RUB - Russian Ruble</SelectItem>
                        <SelectItem value="KRW">KRW - South Korean Won</SelectItem>
                        <SelectItem value="SGD">SGD - Singapore Dollar</SelectItem>
                        <SelectItem value="NZD">NZD - New Zealand Dollar</SelectItem>
                        <SelectItem value="MXN">MXN - Mexican Peso</SelectItem>
                        <SelectItem value="ZAR">ZAR - South African Rand</SelectItem>
                      </SelectContent>
                    </Select>
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline" disabled={isLoading}>Cancel</Button></DialogClose>
                <Button onClick={handleSave} disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
            </DialogFooter>
        </DialogContent>
    );
};

const allIndianBanks = [
    "State Bank of India", "HDFC Bank", "ICICI Bank", "Punjab National Bank", "Bank of Baroda",
    "Axis Bank", "Canara Bank", "Union Bank of India", "Kotak Mahindra Bank", "IndusInd Bank",
    "Bank of India", "Yes Bank", "IDBI Bank", "Central Bank of India", "Indian Bank",
    "UCO Bank", "Indian Overseas Bank", "Federal Bank", "South Indian Bank", "Karnataka Bank",
    "Jammu & Kashmir Bank", "City Union Bank", "Karur Vysya Bank", "RBL Bank", "IDFC First Bank",
    "Bandhan Bank", "CSB Bank", "Dhanlaxmi Bank", "Nainital Bank", "DCB Bank",
    "Allahabad Bank (merged with Indian Bank)", "Andhra Bank (merged with Union Bank)",
    "Corporation Bank (merged with Union Bank)", "Dena Bank (merged with Bank of Baroda)",
    "Oriental Bank of Commerce (merged with PNB)", "Syndicate Bank (merged with Canara Bank)",
    "United Bank of India (merged with PNB)", "Vijaya Bank (merged with Bank of Baroda)"
];

const PaymentDialog = () => {
    const { toast } = useToast();
    const [view, setView] = useState<'options' | 'netbanking' | 'bank-details'>('options');
    const [selectedBank, setSelectedBank] = useState<string | null>(null);
    const [bankSearchQuery, setBankSearchQuery] = useState("");

    const handlePaymentAction = (method: string) => {
        if (method === 'Net Banking') {
            setView('netbanking');
        } else {
            toast({
                title: "Payment Simulated",
                description: `Payment initiated via ${method}. In a real app, this would redirect to a payment gateway.`,
            });
        }
    };
    
    const handleBankSelect = (bankName: string) => {
        setSelectedBank(bankName);
        setView('bank-details');
    };

    const handleFinalPayment = () => {
         toast({
            title: "Payment Simulated",
            description: `Payment initiated via ${selectedBank}. In a real app, this would connect to the bank's portal.`,
        });
    }

    const filteredBanks = allIndianBanks.filter(bank => 
        bank.toLowerCase().includes(bankSearchQuery.toLowerCase())
    );
    
    if (view === 'bank-details' && selectedBank) {
        return (
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Login to {selectedBank}</DialogTitle>
                    <DialogDescription>
                        Enter your credentials to complete the payment. This is a simulation.
                    </DialogDescription>
                </DialogHeader>
                 <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="user-id">User ID</Label>
                        <Input id="user-id" placeholder="Enter your User ID" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input id="password" type="password" placeholder="Enter your password" />
                    </div>
                </div>
                <DialogFooter className="sm:justify-between">
                    <Button variant="outline" onClick={() => { setView('netbanking'); setSelectedBank(null); }}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <DialogClose asChild>
                        <Button type="button" onClick={handleFinalPayment}>Login & Pay</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        );
    }
    
    if (view === 'netbanking') {
        return (
            <DialogContent className="sm:max-w-md">
                 <DialogHeader>
                    <DialogTitle>Select Your Bank</DialogTitle>
                    <DialogDescription>Choose your bank to proceed with Net Banking.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                     <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input 
                            placeholder="Search for your bank..." 
                            className="pl-10"
                            value={bankSearchQuery}
                            onChange={(e) => setBankSearchQuery(e.target.value)}
                        />
                    </div>
                    <ScrollArea className="h-64 border rounded-md">
                        <div className="p-2 space-y-1">
                            {filteredBanks.map(bank => (
                                <Button 
                                    key={bank}
                                    type="button"
                                    variant="ghost" 
                                    className="w-full justify-start"
                                    onClick={() => handleBankSelect(bank)}
                                >
                                    {bank}
                                </Button>
                            ))}
                            {filteredBanks.length === 0 && (
                                <p className="text-center text-sm text-muted-foreground py-4">No banks found.</p>
                            )}
                        </div>
                    </ScrollArea>
                </div>
                 <DialogFooter>
                    <Button variant="outline" onClick={() => setView('options')}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Payment Options
                    </Button>
                </DialogFooter>
            </DialogContent>
        );
    }

    return (
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Complete Your Payment</DialogTitle>
                <DialogDescription>
                    Choose your preferred payment method to pay the fees.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <Button className="w-full justify-start py-6" variant="outline" type="button" onClick={() => handlePaymentAction('Google Pay')}>
                    <Wallet className="mr-4 h-6 w-6 text-primary" />
                    <span className="text-base">Google Pay</span>
                </Button>
                <Button className="w-full justify-start py-6" variant="outline" type="button" onClick={() => handlePaymentAction('PhonePe')}>
                    <Wallet className="mr-4 h-6 w-6 text-primary" />
                    <span className="text-base">PhonePe</span>
                </Button>
                <Button className="w-full justify-start py-6" variant="outline" type="button" onClick={() => handlePaymentAction('Paytm')}>
                    <Wallet className="mr-4 h-6 w-6 text-primary" />
                    <span className="text-base">Paytm</span>
                </Button>
                <Button className="w-full justify-start py-6" variant="outline" type="button" onClick={() => handlePaymentAction('UPI')}>
                    <Wallet className="mr-4 h-6 w-6 text-primary" />
                    <span className="text-base">UPI</span>
                </Button>
                <Button className="w-full justify-start py-6" variant="outline" type="button" onClick={() => handlePaymentAction('Net Banking')}>
                    <Landmark className="mr-4 h-6 w-6 text-primary" />
                    <span className="text-base">Net Banking</span>
                </Button>
                <Button className="w-full justify-start py-6" variant="outline" type="button" onClick={() => handlePaymentAction('Credit/Debit Card')}>
                    <CreditCard className="mr-4 h-6 w-6 text-primary" />
                    <span className="text-base">Credit/Debit Card</span>
                </Button>
            </div>
            <DialogFooter className="text-xs text-muted-foreground text-center">
                <p>
                    Please note: A 2% convenience fee is included in the payment amount to support the developer. This is a UI mockup; no real transaction will occur.
                </p>
            </DialogFooter>
        </DialogContent>
    );
};

const AudioRecordingDialog = React.memo(({ onAudioRecorded }: { onAudioRecorded: (blob: Blob) => void }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const { toast } = useToast();

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            mediaRecorderRef.current.ondataavailable = (event) => {
                chunksRef.current.push(event.data);
            };
            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                setAudioUrl(URL.createObjectURL(blob));
                chunksRef.current = [];
                stream.getTracks().forEach(track => track.stop());
            };
            chunksRef.current = [];
            mediaRecorderRef.current.start();
            setIsRecording(true);
            setAudioBlob(null);
            setAudioUrl(null);
        } catch (error) {
            console.error("Error starting recording:", error);
            toast({ variant: 'destructive', title: 'Recording Failed', description: 'Could not access microphone. Please grant permission.' });
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };
    
    const handleAttach = () => {
      if (audioBlob) {
        onAudioRecorded(audioBlob);
      }
    };

    const handleReset = () => {
      setAudioBlob(null);
      if(audioUrl) {
          URL.revokeObjectURL(audioUrl);
          setAudioUrl(null);
      }
    }

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Record Audio Announcement</DialogTitle>
                <DialogDescription>Record a short audio message to attach to your announcement.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center space-y-4 py-6">
                {!isRecording && !audioUrl && (
                    <Button onClick={startRecording} size="lg" className="rounded-full h-16 w-16 p-0">
                        <Mic className="h-8 w-8" />
                    </Button>
                )}
                {isRecording && (
                    <Button onClick={stopRecording} variant="destructive" size="lg" className="rounded-full h-16 w-16 p-0">
                        <StopCircle className="h-8 w-8" />
                    </Button>
                )}
                {audioUrl && (
                    <div className="w-full space-y-3">
                      <audio src={audioUrl} controls className="w-full rounded-lg" />
                      <Button onClick={handleReset} variant="outline" size="sm" className="w-full">
                        <Trash2 className="mr-2 h-4 w-4" /> Record Again
                      </Button>
                    </div>
                )}
                <p className="text-sm text-muted-foreground">
                    {isRecording ? "Recording..." : audioUrl ? "Preview your recording." : "Click to start recording."}
                </p>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <DialogClose asChild>
                  <Button onClick={handleAttach} disabled={!audioBlob}>
                    Attach Recording
                  </Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    );
});
AudioRecordingDialog.displayName = 'AudioRecordingDialog';


const AddMaterialDialog = React.memo(({ teachingId, onMaterialAdded }: { teachingId: string; onMaterialAdded: () => void }) => {
    const [materialType, setMaterialType] = useState<'file' | 'link'>('file');
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setTitle(e.target.files[0].name);
        }
    };
    
    const handleSubmit = async () => {
        if (!title.trim()) {
            toast({ variant: 'destructive', title: 'Title is required' });
            return;
        }

        setIsUploading(true);
        try {
            if (materialType === 'file') {
                if (!file) {
                    toast({ variant: 'destructive', title: 'File is required' });
                    setIsUploading(false);
                    return;
                }
                const fileRef = storageRef(storage, `classrooms/${teachingId}/materials/${Date.now()}-${file.name}`);
                const snapshot = await uploadBytes(fileRef, file);
                const downloadURL = await getDownloadURL(snapshot.ref);

                await addDoc(collection(db, `classrooms/${teachingId}/materials`), {
                    type: 'file',
                    title: title.trim(),
                    url: downloadURL,
                    fileName: file.name,
                    fileSize: `${(file.size / (1024*1024)).toFixed(2)} MB`,
                    createdAt: serverTimestamp(),
                });
            } else {
                if (!url.trim()) {
                    toast({ variant: 'destructive', title: 'URL is required' });
                    setIsUploading(false);
                    return;
                }
                await addDoc(collection(db, `classrooms/${teachingId}/materials`), {
                    type: 'link',
                    title: title.trim(),
                    url: url.trim(),
                    createdAt: serverTimestamp(),
                });
            }
            toast({ title: 'Material Added!', description: `"${title.trim()}" has been added.` });
            onMaterialAdded();
        } catch (error) {
            console.error('Error adding material:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not add material.' });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Add New Material</DialogTitle>
                <DialogDescription>Upload a file or add a web link for your students.</DialogDescription>
            </DialogHeader>
            <Tabs value={materialType} onValueChange={(value) => setMaterialType(value as 'file' | 'link')} className="pt-4">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="file"><UploadCloud className="mr-2 h-4 w-4"/>Upload File</TabsTrigger>
                    <TabsTrigger value="link"><LinkIcon className="mr-2 h-4 w-4"/>Add Link</TabsTrigger>
                </TabsList>
                <TabsContent value="file" className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="file-title">Title</Label>
                        <Input id="file-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Lecture 1 Slides" />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="file-upload">File</Label>
                        <Input id="file-upload" type="file" onChange={handleFileChange} />
                    </div>
                </TabsContent>
                <TabsContent value="link" className="space-y-4 pt-4">
                     <div className="space-y-2">
                        <Label htmlFor="link-title">Title</Label>
                        <Input id="link-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Required Reading Article" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="link-url">URL</Label>
                        <Input id="link-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
                    </div>
                </TabsContent>
            </Tabs>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline" disabled={isUploading}>Cancel</Button></DialogClose>
                <Button onClick={handleSubmit} disabled={isUploading}>
                    {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                    {isUploading ? 'Adding...' : 'Add Material'}
                </Button>
            </DialogFooter>
        </DialogContent>
    );
});
AddMaterialDialog.displayName = 'AddMaterialDialog';

const ExamDialog = React.memo(({ classroomId, onExamAction, examToEdit }: { classroomId: string; onExamAction: () => void; examToEdit: Exam | null }) => {
    const [examType, setExamType] = useState<'file' | 'manual'>('file');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);
    const [file, setFile] = useState<File | null>(null);
    const [isPublished, setIsPublished] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const [questions, setQuestions] = useState<ManualQuestion[]>([]);

    useEffect(() => {
        if (examToEdit) {
            setTitle(examToEdit.title);
            setDescription(examToEdit.description);
            setStartDate(new Date(examToEdit.startDate.seconds * 1000));
            setEndDate(new Date(examToEdit.endDate.seconds * 1000));
            setIsPublished(examToEdit.status === 'published');
            setExamType(examToEdit.type || 'file');
            setQuestions(examToEdit.questions || []);
        } else {
            setTitle('');
            setDescription('');
            setStartDate(undefined);
            setEndDate(undefined);
            setIsPublished(false);
            setExamType('file');
            setQuestions([]);
        }
    }, [examToEdit]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };
    
    const handleAddQuestion = (type: 'multiple-choice' | 'short-answer') => {
        const newQuestion: ManualQuestion = {
            id: `q_${Date.now()}`,
            type,
            questionText: '',
            options: type === 'multiple-choice' ? ['', '', '', ''] : undefined,
            correctAnswer: type === 'multiple-choice' ? 0 : undefined,
        };
        setQuestions(prev => [...prev, newQuestion]);
    };

    const handleQuestionChange = (id: string, newText: string) => {
        setQuestions(prev => prev.map(q => q.id === id ? { ...q, questionText: newText } : q));
    };

    const handleOptionChange = (qId: string, optIndex: number, newText: string) => {
        setQuestions(prev => prev.map(q => q.id === qId ? { ...q, options: q.options?.map((opt, i) => i === optIndex ? newText : opt) } : q));
    };

    const handleCorrectAnswerChange = (qId: string, optIndex: number) => {
        setQuestions(prev => prev.map(q => q.id === qId ? { ...q, correctAnswer: optIndex } : q));
    };

    const handleRemoveQuestion = (id: string) => {
        setQuestions(prev => prev.filter(q => q.id !== id));
    };

    const handleSubmit = async () => {
        if (!title.trim() || !startDate || !endDate) {
            toast({ variant: 'destructive', title: 'Missing Fields', description: 'Title, start date, and end date are required.' });
            return;
        }

        if (examType === 'manual' && questions.length === 0) {
            toast({ variant: 'destructive', title: 'No Questions', description: 'Please add at least one question for a manual exam.' });
            return;
        }

        setIsLoading(true);
        try {
            let fileURL: string | undefined = examToEdit?.fileURL;
            let fileName: string | undefined = examToEdit?.fileName;

            if (examType === 'file' && file) {
                const fileRef = storageRef(storage, `classrooms/${classroomId}/exams/${Date.now()}-${file.name}`);
                const snapshot = await uploadBytes(fileRef, file);
                fileURL = await getDownloadURL(snapshot.ref);
                fileName = file.name;
            }

            const examData: Omit<Exam, 'id' | 'createdAt'> = {
                title: title.trim(),
                description: description.trim(),
                startDate,
                endDate,
                status: isPublished ? 'published' : 'draft',
                type: examType,
                fileURL: examType === 'file' ? fileURL : undefined,
                fileName: examType === 'file' ? fileName : undefined,
                questions: examType === 'manual' ? questions : undefined,
            };

            if (examToEdit) {
                const examRef = doc(db, 'classrooms', classroomId, 'exams', examToEdit.id);
                await updateDoc(examRef, examData as any);
                toast({ title: 'Exam Updated', description: `"${title.trim()}" has been updated.` });
            } else {
                await addDoc(collection(db, 'classrooms', classroomId, 'exams'), {
                    ...examData,
                    createdAt: serverTimestamp(),
                });
                toast({ title: 'Exam Created', description: `"${title.trim()}" has been created.` });
            }
            onExamAction();

        } catch (error) {
            console.error('Error saving exam:', error);
            toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the exam.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>{examToEdit ? 'Edit Exam' : 'Create New Exam'}</DialogTitle>
                <DialogDescription>{examToEdit ? 'Update details for this exam.' : 'Create a new exam by uploading a file or adding questions manually.'}</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                {/* Left Column: General Details */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Title</Label>
                        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Mid-Term Exam" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="(Optional) Instructions or details" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Start Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus /></PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label>End Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus /></PopoverContent>
                            </Popover>
                        </div>
                    </div>
                     <div className="flex items-center justify-end space-x-2 pt-4 border-t">
                        <Label htmlFor="publish-switch">Publish to Students</Label>
                        <Switch id="publish-switch" checked={isPublished} onCheckedChange={setIsPublished}/>
                    </div>
                </div>

                {/* Right Column: Exam Content */}
                <Tabs value={examType} onValueChange={(v) => setExamType(v as any)} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="file"><FileUp className="mr-2 h-4 w-4"/>Upload File</TabsTrigger>
                        <TabsTrigger value="manual"><Type className="mr-2 h-4 w-4"/>Create Manually</TabsTrigger>
                    </TabsList>
                    <TabsContent value="file" className="mt-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="file">Exam Paper</Label>
                            <Input id="file" type="file" onChange={handleFileChange} />
                        </div>
                        {file && <p className="text-sm text-muted-foreground">Attaching: {file.name}</p>}
                        {examToEdit && examToEdit.fileName && !file && <p className="text-sm text-muted-foreground">Current file: {examToEdit.fileName}</p>}
                    </TabsContent>
                    <TabsContent value="manual" className="mt-4 space-y-4">
                        <div className="space-x-2">
                            <Button variant="outline" size="sm" onClick={() => handleAddQuestion('multiple-choice')}>+ Multiple Choice</Button>
                            <Button variant="outline" size="sm" onClick={() => handleAddQuestion('short-answer')}>+ Short Answer</Button>
                        </div>
                        <ScrollArea className="h-64 border rounded-md p-4 space-y-4">
                            {questions.length === 0 && <p className="text-sm text-muted-foreground text-center">No questions added yet.</p>}
                            {questions.map((q, index) => (
                                <div key={q.id} className="p-3 border rounded-lg space-y-2 bg-muted/50">
                                    <div className="flex justify-between items-center">
                                        <Label>Question {index + 1}</Label>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveQuestion(q.id)}><Trash2 className="h-4 w-4"/></Button>
                                    </div>
                                    <Textarea placeholder="Type your question..." value={q.questionText} onChange={(e) => handleQuestionChange(q.id, e.target.value)} />
                                    {q.type === 'multiple-choice' && (
                                        <RadioGroup onValueChange={(val) => handleCorrectAnswerChange(q.id, parseInt(val))} defaultValue={String(q.correctAnswer ?? 0)}>
                                            <div className="space-y-2 mt-2">
                                                {q.options?.map((opt, i) => (
                                                    <div key={i} className="flex items-center gap-2">
                                                        <RadioGroupItem value={String(i)} id={`${q.id}-opt-${i}`} />
                                                        <Input placeholder={`Option ${i + 1}`} value={opt} onChange={(e) => handleOptionChange(q.id, i, e.target.value)} className="flex-1"/>
                                                    </div>
                                                ))}
                                            </div>
                                        </RadioGroup>
                                    )}
                                </div>
                            ))}
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </div>
            
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button onClick={handleSubmit} disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : examToEdit ? "Save Changes" : "Create Exam"}
                </Button>
            </DialogFooter>
        </DialogContent>
    );
});
ExamDialog.displayName = 'ExamDialog';


const AssignmentDialog = React.memo(({ classroomId, onAssignmentAction, assignmentToEdit }: { classroomId: string; onAssignmentAction: () => void, assignmentToEdit: Assignment | null }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (assignmentToEdit) {
            setTitle(assignmentToEdit.title);
            setDescription(assignmentToEdit.description);
            setDueDate(new Date(assignmentToEdit.dueDate.seconds * 1000));
        } else {
            setTitle('');
            setDescription('');
            setDueDate(undefined);
        }
    }, [assignmentToEdit]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async () => {
        if (!title.trim() || !dueDate) {
            toast({ variant: 'destructive', title: 'Missing Fields', description: 'Title and due date are required.' });
            return;
        }

        setIsLoading(true);
        try {
            let fileURL: string | undefined = assignmentToEdit?.fileURL;
            let fileName: string | undefined = assignmentToEdit?.fileName;

            if (file) {
                const fileRef = storageRef(storage, `classrooms/${classroomId}/assignments/${Date.now()}-${file.name}`);
                const snapshot = await uploadBytes(fileRef, file);
                fileURL = await getDownloadURL(snapshot.ref);
                fileName = file.name;
            }

            const assignmentData = {
                title: title.trim(),
                description: description.trim(),
                dueDate: dueDate,
                fileURL,
                fileName,
            };

            if (assignmentToEdit) {
                const assignmentRef = doc(db, 'classrooms', classroomId, 'assignments', assignmentToEdit.id);
                await updateDoc(assignmentRef, {
                    ...assignmentData,
                    dueDate: assignmentData.dueDate, // Ensure date is passed correctly
                });
                toast({ title: 'Assignment Updated', description: `"${title.trim()}" has been updated.` });
            } else {
                await addDoc(collection(db, 'classrooms', classroomId, 'assignments'), {
                    ...assignmentData,
                    createdAt: serverTimestamp(),
                });
                toast({ title: 'Assignment Created', description: `"${title.trim()}" has been created.` });
            }
            onAssignmentAction();

        } catch (error) {
            console.error('Error saving assignment:', error);
            toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the assignment.' });
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>{assignmentToEdit ? 'Edit Assignment' : 'Create New Assignment'}</DialogTitle>
                <DialogDescription>{assignmentToEdit ? 'Update details for this assignment.' : 'Fill out the details for the new assignment.'}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="title" className="text-right">Title</Label>
                    <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="col-span-3" placeholder="e.g., Weekly Homework"/>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-right">Description</Label>
                    <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3" placeholder="(Optional) Instructions or details"/>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Due Date</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("col-span-3 justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus /></PopoverContent>
                    </Popover>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="file" className="text-right">File</Label>
                    <Input id="file" type="file" onChange={handleFileChange} className="col-span-3"/>
                </div>
                 {file && <p className="col-span-4 text-sm text-muted-foreground text-center">Attaching: {file.name}</p>}
                 {assignmentToEdit && assignmentToEdit.fileName && !file && <p className="col-span-4 text-sm text-muted-foreground text-center">Current file: {assignmentToEdit.fileName}</p>}
            </div>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button onClick={handleSubmit} disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : assignmentToEdit ? "Save Changes" : "Create"}
                </Button>
            </DialogFooter>
        </DialogContent>
    );
});
AssignmentDialog.displayName = 'AssignmentDialog';


export default function ClassroomPage() {
  const params = useParams();
  const classroomId = params.classroomId as string;
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const { setHeaderContent, setHeaderAction } = useDynamicHeader();

  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [subjectTeachers, setSubjectTeachers] = useState<SubjectTeacher[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  
  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [audioAttachment, setAudioAttachment] = useState<Blob | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);

  const [isExamDialogOpen, setIsExamDialogOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  const [newChatMessage, setNewChatMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const chatScrollAreaRef = useRef<HTMLDivElement>(null);

  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [isCheckingAI, setIsCheckingAI] = useState<string | null>(null);
  
  const [isEditFeeOpen, setIsEditFeeOpen] = useState(false);

  const [isTeacherDialogOpen, setIsTeacherDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<SubjectTeacher | null>(null);

  const isTeacher = user?.uid === classroom?.teacherId;

  useEffect(() => {
    if (!classroom) {
      setHeaderContent(null);
      setHeaderAction(null);
      return;
    }

    setHeaderContent(
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-bold leading-7 text-foreground sm:truncate sm:text-2xl sm:tracking-tight">
          {classroom.title}
        </h2>
        <p className="text-sm text-muted-foreground mt-1 truncate">Taught by: {classroom.teacherName}</p>
      </div>
    );
    setHeaderAction(
      <Button asChild variant="outline" className="rounded-lg">
        <Link href="/dashboard/classrooms">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Classrooms
        </Link>
      </Button>
    );

    return () => {
      setHeaderContent(null);
      setHeaderAction(null);
    };
  }, [classroom, setHeaderContent, setHeaderAction]);

  useEffect(() => {
    if (!classroomId) return;
    
    const unsubClassroom = onSnapshot(doc(db, 'classrooms', classroomId), (docSnap) => {
      if (docSnap.exists()) {
        setClassroom({ id: docSnap.id, ...docSnap.data() } as Classroom);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Classroom not found.' });
        router.push('/dashboard/classrooms');
      }
      setIsLoading(false);
    });

    const unsubAnnouncements = onSnapshot(query(collection(db, 'classrooms', classroomId, 'announcements'), orderBy('createdAt', 'desc')), (snapshot) => {
        setAnnouncements(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Announcement)));
    });
    
    const unsubMaterials = onSnapshot(query(collection(db, 'classrooms', classroomId, 'materials'), orderBy('createdAt', 'desc')), (snapshot) => {
        setMaterials(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Material)));
    });

    const unsubExams = onSnapshot(query(collection(db, 'classrooms', classroomId, 'exams'), orderBy('createdAt', 'desc')), (snapshot) => {
        setExams(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Exam)));
    });

    const unsubAssignments = onSnapshot(query(collection(db, 'classrooms', classroomId, 'assignments'), orderBy('createdAt', 'desc')), (snapshot) => {
        setAssignments(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Assignment)));
    });
    
    const unsubTeachers = onSnapshot(query(collection(db, 'classrooms', classroomId, 'teachers'), orderBy('name')), (snapshot) => {
        setSubjectTeachers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SubjectTeacher)));
    });

    const unsubChat = onSnapshot(query(collection(db, 'classrooms', classroomId, 'chat'), orderBy('createdAt', 'asc')), (snapshot) => {
        setChatMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)));
    });

    return () => { 
        unsubClassroom();
        unsubAnnouncements();
        unsubMaterials();
        unsubExams();
        unsubAssignments();
        unsubTeachers();
        unsubChat();
     };
  }, [classroomId, router, toast]);

  useEffect(() => {
    if (selectedAssignment) {
        const subCollectionRef = collection(db, `classrooms/${classroomId}/assignments/${selectedAssignment.id}/submissions`);
        const q = query(subCollectionRef, orderBy('submittedAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedSubmissions = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AssignmentSubmission));
            setSubmissions(fetchedSubmissions);
        });

        return () => unsubscribe();
    }
  }, [selectedAssignment, classroomId]);
  
  useEffect(() => {
    if (chatScrollAreaRef.current) {
        const viewport = chatScrollAreaRef.current.children[1] as HTMLDivElement;
        if(viewport) {
           viewport.scrollTop = viewport.scrollHeight;
        }
    }
  }, [chatMessages]);

  useEffect(() => {
    if (isTeacher && classroomId) {
      const unsubRequests = onSnapshot(query(collection(db, 'classrooms', classroomId, 'joinRequests')), (snapshot) => {
        const reqs: JoinRequest[] = [];
        snapshot.forEach(d => {
            const data = d.data();
            reqs.push({
                id: d.id,
                studentName: data.studentName,
                studentPhotoURL: data.studentPhotoURL,
                studentId: data.userId, // Use userId field from the document
            });
        });
        setJoinRequests(reqs);
      });
      return () => unsubRequests();
    }
  }, [isTeacher, classroomId]);

  const handleRequestAction = useCallback(async (requestId: string, approve: boolean) => {
    if (!isTeacher || !classroomId) return;

    try {
        const requestRef = doc(db, 'classrooms', classroomId, 'joinRequests', requestId);
        
        if (approve) {
            const studentRequestSnap = await getDoc(requestRef);
            if (!studentRequestSnap.exists()) {
                throw new Error("Join request not found.");
            }
            const requestData = studentRequestSnap.data();
            const studentId = requestData.userId; // Assuming userId is stored in request

            const batch = writeBatch(db);
            const enrollmentRef = doc(db, 'users', studentId, 'enrolled', classroomId);
            batch.set(enrollmentRef, {
                classroomId: classroomId,
                title: classroom?.title,
                description: classroom?.description,
                teacherName: classroom?.teacherName,
                enrolledAt: serverTimestamp(),
            });
            batch.delete(requestRef);

            // Also delete from the user's pending requests
            const userPendingRequestRef = doc(db, `users/${studentId}/pendingJoinRequests`, classroomId);
            batch.delete(userPendingRequestRef);

            await batch.commit();

        } else {
            const studentRequestSnap = await getDoc(requestRef);
             if (studentRequestSnap.exists()) {
                const requestData = studentRequestSnap.data();
                const studentId = requestData.userId;
                const batch = writeBatch(db);
                batch.delete(requestRef);
                 const userPendingRequestRef = doc(db, `users/${studentId}/pendingJoinRequests`, classroomId);
                batch.delete(userPendingRequestRef);
                await batch.commit();
            }
        }
        
        toast({ title: `Request ${approve ? 'Approved' : 'Denied'}`, description: `The student has been ${approve ? 'added to the class' : 'denied entry'}.` });
    } catch (error) {
        console.error("Error handling join request:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not process the request. Check console for permissions errors.' });
    }
  }, [isTeacher, classroomId, classroom, toast]);
  
  const handlePostAnnouncement = async () => {
    if ((!newAnnouncement.trim() && !audioAttachment) || !user || !isTeacher) return;
    setIsPosting(true);

    try {
      let audioURL: string | undefined = undefined;
      if (audioAttachment) {
        const audioRef = storageRef(storage, `classrooms/${classroomId}/announcements/${Date.now()}.webm`);
        const snapshot = await uploadBytes(audioRef, audioAttachment);
        audioURL = await getDownloadURL(snapshot.ref);
      }

      await addDoc(collection(db, `classrooms/${classroomId}/announcements`), {
        content: newAnnouncement.trim(),
        authorName: user.displayName || 'Teacher',
        authorId: user.uid,
        createdAt: serverTimestamp(),
        audioURL: audioURL,
      });

      setNewAnnouncement('');
      setAudioAttachment(null);
      toast({ title: "Announcement Posted!" });
    } catch (error) {
      console.error("Error posting announcement:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not post announcement." });
    } finally {
      setIsPosting(false);
    }
  };

  const handleAudioRecorded = useCallback((blob: Blob) => {
      setAudioAttachment(blob);
      toast({ title: "Audio Attached", description: "Your recording is ready to be posted with the announcement." });
  }, [toast]);
  
  const handleDeleteMaterial = async (material: Material) => {
    if (!isTeacher) return;
    try {
        await deleteDoc(doc(db, 'classrooms', classroomId, 'materials', material.id));
        if (material.type === 'file') {
            const fileStorageRef = storageRef(storage, material.url);
            await deleteFile(fileStorageRef);
        }
        toast({title: 'Material Deleted', description: `"${material.title}" has been removed.`});
    } catch (error) {
        console.error("Error deleting material:", error);
        toast({variant: 'destructive', title: 'Error', description: 'Could not delete the material.'});
    }
  };

  const handleOpenExamDialog = (exam: Exam | null) => {
    setEditingExam(exam);
    setIsExamDialogOpen(true);
  };
  
  const handleDeleteExam = async (exam: Exam) => {
    if (!isTeacher) return;
    try {
      await deleteDoc(doc(db, 'classrooms', classroomId, 'exams', exam.id));
      if (exam.fileURL) {
        const fileRef = storageRef(storage, exam.fileURL);
        await deleteFile(fileRef).catch(err => console.warn("Could not delete exam file, it might not exist:", err));
      }
      toast({ title: 'Exam Deleted', description: `"${exam.title}" has been removed.` });
    } catch (error) {
      console.error("Error deleting exam:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the exam.' });
    }
  };
  
  const handleOpenAssignmentDialog = (assignment: Assignment | null) => {
    setEditingAssignment(assignment);
    setIsAssignmentDialogOpen(true);
  };
  
  const handleDeleteAssignment = async (assignment: Assignment) => {
    if (!isTeacher) return;
    try {
      await deleteDoc(doc(db, 'classrooms', classroomId, 'assignments', assignment.id));
      if (assignment.fileURL) {
        const fileRef = storageRef(storage, assignment.fileURL);
        await deleteFile(fileRef).catch(err => console.warn("Could not delete assignment file, it might not exist:", err));
      }
      toast({ title: 'Assignment Deleted', description: `"${assignment.title}" has been removed.` });
    } catch (error) {
      console.error("Error deleting assignment:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the assignment.' });
    }
  };

  const handleOpenTeacherDialog = (teacher: SubjectTeacher | null) => {
    setEditingTeacher(teacher);
    setIsTeacherDialogOpen(true);
  };

  const handleDeleteTeacher = async (teacher: SubjectTeacher) => {
    if (!isTeacher) return;
    try {
      await deleteDoc(doc(db, 'classrooms', classroomId, 'teachers', teacher.id));
      toast({ title: 'Teacher Removed', description: `${teacher.name} has been removed from the class.` });
    } catch (error) {
      console.error("Error deleting teacher:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not remove the teacher.' });
    }
  };

  const handleSendMessage = async () => {
    if (!newChatMessage.trim() || !user) return;

    setIsSendingMessage(true);
    try {
        await addDoc(collection(db, `classrooms/${classroomId}/chat`), {
            text: newChatMessage.trim(),
            senderId: user.uid,
            senderName: user.displayName || 'Anonymous',
            senderPhotoURL: user.photoURL,
            createdAt: serverTimestamp(),
        });
        setNewChatMessage('');
    } catch (error) {
        console.error("Error sending chat message:", error);
        toast({ variant: 'destructive', title: 'Send Failed', description: 'Could not send your message.' });
    } finally {
        setIsSendingMessage(false);
    }
  };

  const handleAssignmentSubmit = async (file: File) => {
    if (!user || !selectedAssignment) return;

    const toastId = `upload-${Date.now()}`;
    toast({ id: toastId, title: "Submitting Assignment...", duration: Infinity });

    try {
        const submissionPath = `classrooms/${classroomId}/assignments/${selectedAssignment.id}/submissions/${user.uid}/${file.name}`;
        const submissionRef = storageRef(storage, submissionPath);
        const snapshot = await uploadBytes(submissionRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        const submissionDocRef = doc(db, `classrooms/${classroomId}/assignments/${selectedAssignment.id}/submissions`, user.uid);
        await setDoc(submissionDocRef, {
            studentName: user.displayName,
            studentPhotoURL: user.photoURL,
            submittedAt: serverTimestamp(),
            fileURL: downloadURL,
            fileName: file.name,
        });

        toast({ id: toastId, title: "Assignment Submitted!", description: "Your submission has been received." });
    } catch (error) {
        console.error("Error submitting assignment:", error);
        toast({ id: toastId, variant: 'destructive', title: "Submission Failed", description: "Could not submit your assignment." });
    }
  };
  
  const blobToDataURI = (blob: Blob): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target?.result as string);
          reader.onerror = e => reject(e);
          reader.readAsDataURL(blob);
      });
  };

  const handleAutoCheck = async (submission: AssignmentSubmission) => {
    if (!selectedAssignment || !selectedAssignment.fileURL) {
      toast({ variant: 'destructive', title: 'Missing Key', description: "Teacher's assignment file is missing." });
      return;
    }
    
    setIsCheckingAI(submission.id);
    const toastId = `check-${submission.id}`;
    toast({ id: toastId, title: "AI Check Started", description: `Grading ${submission.studentName}'s assignment...`, duration: Infinity });

    try {
        const teacherFileRef = storageRef(storage, selectedAssignment.fileURL);
        const studentFileRef = storageRef(storage, submission.fileURL);

        const [teacherBlob, studentBlob] = await Promise.all([getBlob(teacherFileRef), getBlob(studentFileRef)]);
        
        const [teacherAssignmentDataUri, studentSubmissionDataUri] = await Promise.all([
            blobToDataURI(teacherBlob),
            blobToDataURI(studentBlob)
        ]);
        
        const result = await gradeAssignment({ teacherAssignmentDataUri, studentSubmissionDataUri });

        const submissionDocRef = doc(db, `classrooms/${classroomId}/assignments/${selectedAssignment.id}/submissions`, submission.id);
        await updateDoc(submissionDocRef, {
            grade: {
                score: result.score,
                feedback: result.feedback,
                gradedAt: serverTimestamp()
            }
        });

        toast({ id: toastId, title: "Grading Complete!", description: `${submission.studentName} scored ${result.score}/100.` });

    } catch (error) {
        console.error("AI Grading error:", error);
        toast({ id: toastId, variant: 'destructive', title: 'AI Check Failed', description: error instanceof Error ? error.message : "An unknown error occurred." });
    } finally {
        setIsCheckingAI(null);
    }
  };


  if (isLoading) {
    return (
      <div className="space-y-4 p-4 md:p-8">
        <Skeleton className="h-10 w-1/4 mb-4" />
        <Skeleton className="h-6 w-1/2 mb-8" />
        <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!classroom) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4 md:p-8">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-bold">Classroom Not Found</h2>
        <p className="text-muted-foreground">The classroom you are looking for does not exist or has been deleted.</p>
        <Button asChild className="mt-6">
          <Link href="/dashboard/classrooms">Go Back to Classrooms</Link>
        </Button>
      </div>
    );
  }

  const tabItems = [
    { value: "announcements", label: "Announcements", icon: Bell },
    { value: "materials", label: "Materials", icon: Book },
    { value: "assignments", label: "Assignments", icon: ClipboardList },
    { value: "exams", label: "Exams", icon: FileText },
    { value: "teachers", label: "Teachers", icon: Users },
    { value: "fees", label: "Fees", icon: CreditCard },
    { value: "chat", label: "Chat", icon: MessageSquare },
  ];
  
  const displayedExams = isTeacher ? exams : exams.filter(a => a.status === 'published');
  
  const feeAmountFormatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: classroom.feeCurrency || 'USD',
  }).format(classroom.feeAmount ?? 500);

  return (
    <div className="flex flex-col gap-4 pb-24 px-4 md:px-8">
      {isTeacher && joinRequests.length > 0 && (
          <div className="pt-4">
              <Card className="bg-primary/10 border-primary/20">
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5"/>Join Requests ({joinRequests.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                      <div className="space-y-2">
                      {joinRequests.map(req => (
                          <div key={req.id} className="flex items-center justify-between bg-background p-2 rounded-lg">
                              <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8">
                                      <AvatarImage src={req.studentPhotoURL} data-ai-hint="avatar user"/>
                                      <AvatarFallback>{req.studentName?.charAt(0) || '?'}</AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm font-medium">{req.studentName}</span>
                              </div>
                              <div className="flex gap-2">
                                  <Button size="icon" variant="outline" className="h-8 w-8 bg-green-500/10 text-green-700 hover:bg-green-500/20" onClick={() => handleRequestAction(req.id, true)}><Check className="h-4 w-4"/></Button>
                                  <Button size="icon" variant="outline" className="h-8 w-8 bg-red-500/10 text-red-700 hover:bg-red-500/20" onClick={() => handleRequestAction(req.id, false)}><X className="h-4 w-4"/></Button>
                              </div>
                          </div>
                      ))}
                      </div>
                  </CardContent>
              </Card>
          </div>
        )}
        
        <Tabs defaultValue="announcements" className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-6 mt-4">
          <TabsList className="flex-col h-auto items-start gap-2 bg-transparent p-0 w-full">
            {tabItems.map(({ value, label, icon: Icon }) => (
              <TabsTrigger 
                key={value}
                value={value} 
                className={cn(
                  "w-full justify-start text-base py-3 px-4 rounded-lg",
                  "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg",
                  "hover:bg-muted"
                )}
              >
                <Icon className="mr-3 h-5 w-5" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          
          <div className="md:col-start-2">
              <TabsContent value="announcements" className="mt-0">
                 <Card>
                    <CardHeader>
                      <CardTitle>Announcements</CardTitle>
                      <CardDescription>Latest updates and announcements from the teacher.</CardDescription>
                    </CardHeader>
                     <CardContent className="space-y-4 pt-6">
                        {isTeacher && (
                          <Dialog>
                            <div className="flex gap-2 items-start">
                                <Avatar className="mt-1">
                                    <AvatarImage src={user?.photoURL ?? ''} data-ai-hint="avatar user"/>
                                    <AvatarFallback>{user?.displayName?.charAt(0) || 'T'}</AvatarFallback>
                                </Avatar>
                                <div className="flex-grow space-y-2">
                                    <Textarea
                                        placeholder="Write an announcement..."
                                        value={newAnnouncement}
                                        onChange={(e) => setNewAnnouncement(e.target.value)}
                                        className="rounded-lg"
                                        disabled={isPosting}
                                    />
                                    {audioAttachment && (
                                        <div className="p-2 border rounded-lg flex items-center gap-2">
                                            <audio src={URL.createObjectURL(audioAttachment)} controls className="w-full h-8"/>
                                            <Button variant="ghost" size="icon" onClick={() => setAudioAttachment(null)}><Trash2 className="h-4 w-4"/></Button>
                                        </div>
                                    )}
                                    <div className="flex justify-end items-center gap-2">
                                      <DialogTrigger asChild>
                                        <Button variant="outline" size="icon" className="rounded-lg" disabled={isPosting}>
                                            <Mic className="h-4 w-4" />
                                        </Button>
                                      </DialogTrigger>
                                      <Button onClick={handlePostAnnouncement} disabled={(!newAnnouncement.trim() && !audioAttachment) || isPosting} size="sm" className="rounded-lg">
                                        {isPosting ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Send className="mr-2 h-4 w-4"/>}
                                        {isPosting ? 'Posting...' : 'Post'}
                                      </Button>
                                    </div>
                                </div>
                            </div>
                            <AudioRecordingDialog onAudioRecorded={handleAudioRecorded} />
                          </Dialog>
                        )}
                        {announcements.length > 0 ? (
                           <div className="space-y-4">
                                {announcements.map(ann => (
                                    <div key={ann.id} className="p-4 bg-muted/50 rounded-lg">
                                        {ann.content && <p className="text-sm text-foreground whitespace-pre-wrap">{ann.content}</p>}
                                        {ann.audioURL && (
                                            <div className="mt-2">
                                                <audio src={ann.audioURL} controls className="w-full rounded-lg" />
                                            </div>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-2">
                                            Posted by {ann.authorName} - {ann.createdAt ? formatDistanceToNow(new Date(ann.createdAt.seconds * 1000), { addSuffix: true }) : 'just now'}
                                        </p>
                                    </div>
                                ))}
                           </div>
                        ) : (
                           <div className="text-center text-muted-foreground py-10">
                                <Bell className="h-12 w-12 mx-auto mb-2" />
                                <p>No announcements yet.</p>
                                <p className="text-xs">Check back later for updates.</p>
                           </div>
                        )}
                    </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="materials" className="mt-0">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Course Materials</CardTitle>
                            <CardDescription>All shared files and links for this classroom.</CardDescription>
                        </div>
                        {isTeacher && (
                          <Dialog open={isAddMaterialOpen} onOpenChange={setIsAddMaterialOpen}>
                            <DialogTrigger asChild>
                                <Button><PlusCircle className="mr-2 h-4 w-4"/>Add Material</Button>
                            </DialogTrigger>
                            <AddMaterialDialog teachingId={classroomId} onMaterialAdded={() => setIsAddMaterialOpen(false)} />
                          </Dialog>
                        )}
                    </CardHeader>
                    <CardContent>
                        {materials.length > 0 ? (
                            <div className="space-y-2">
                                {materials.map(material => (
                                    <div key={material.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted group">
                                        <div className="flex items-center gap-3">
                                            {material.type === 'file' ? <FileText className="h-5 w-5 text-primary"/> : <LinkIcon className="h-5 w-5 text-accent"/>}
                                            <div>
                                                <p className="font-medium text-foreground">{material.title}</p>
                                                <p className="text-xs text-muted-foreground">
                                                  Added on {format(new Date(material.createdAt.seconds * 1000), 'MMM d, yyyy')}
                                                  {material.fileSize && ` - ${material.fileSize}`}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button asChild variant="outline" size="sm">
                                                <a href={material.url} target="_blank" rel="noopener noreferrer">
                                                    {material.type === 'file' ? <Download className="mr-2 h-4 w-4"/> : <ExternalLink className="mr-2 h-4 w-4"/>}
                                                    {material.type === 'file' ? 'Download' : 'Open Link'}
                                                </a>
                                            </Button>
                                            {isTeacher && (
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100" onClick={() => handleDeleteMaterial(material)}>
                                                    <Trash2 className="h-4 w-4"/>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                             <div className="text-center text-muted-foreground py-12">
                                <Book className="h-12 w-12 mx-auto mb-2" />
                                <p>No materials have been added yet.</p>
                             </div>
                        )}
                    </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="assignments" className="mt-0">
                {selectedAssignment ? (
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedAssignment(null)} className="-ml-2"><ArrowLeft className="mr-2 h-4 w-4"/> Back to list</Button>
                                    <CardTitle className="mt-2">{selectedAssignment.title}</CardTitle>
                                    <CardDescription>Due: {format(new Date(selectedAssignment.dueDate.seconds * 1000), "PPP")}</CardDescription>
                                </div>
                                {isTeacher && (
                                    <Button variant="outline" size="sm" onClick={() => handleOpenAssignmentDialog(selectedAssignment)}><Edit className="mr-2 h-4 w-4"/> Edit</Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {selectedAssignment.description && <p className="mb-4 text-sm whitespace-pre-wrap">{selectedAssignment.description}</p>}
                             {selectedAssignment.fileURL && (
                                <Button asChild variant="secondary" className="mb-6"><a href={selectedAssignment.fileURL} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-4 w-4"/>Download Assignment File</a></Button>
                             )}

                            <div className="border-t pt-4">
                                <h3 className="font-semibold text-lg mb-4">{isTeacher ? "Student Submissions" : "Your Submission"}</h3>
                                 {isTeacher ? (
                                    submissions.length > 0 ? (
                                        <div className="space-y-3">
                                            {submissions.map(sub => (
                                                <Card key={sub.id} className="p-3">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar><AvatarImage src={sub.studentPhotoURL} data-ai-hint="avatar student"/><AvatarFallback>{sub.studentName.charAt(0)}</AvatarFallback></Avatar>
                                                            <div>
                                                                <p className="font-medium">{sub.studentName}</p>
                                                                <p className="text-xs text-muted-foreground">Submitted: {formatDistanceToNow(new Date(sub.submittedAt.seconds * 1000), {addSuffix: true})}</p>
                                                                <a href={sub.fileURL} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">View Submission</a>
                                                            </div>
                                                        </div>
                                                        <Button size="sm" variant="outline" onClick={() => handleAutoCheck(sub)} disabled={isCheckingAI !== null}>
                                                            {isCheckingAI === sub.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4"/>}
                                                            {isCheckingAI === sub.id ? 'Checking...':'Auto-Check'}
                                                        </Button>
                                                    </div>
                                                    {sub.grade && (
                                                        <Card className="mt-3 bg-muted/50">
                                                            <CardHeader className="flex flex-row items-center justify-between p-3">
                                                                <CardTitle className="text-base">AI Grade: {sub.grade.score}/100</CardTitle>
                                                                <CardDescription className="text-xs">Graded: {formatDistanceToNow(new Date(sub.grade.gradedAt.seconds * 1000), {addSuffix: true})}</CardDescription>
                                                            </CardHeader>
                                                            <CardContent className="p-3 pt-0">
                                                                <p className="text-sm whitespace-pre-wrap">{sub.grade.feedback}</p>
                                                            </CardContent>
                                                        </Card>
                                                    )}
                                                </Card>
                                            ))}
                                        </div>
                                    ) : <p className="text-sm text-muted-foreground text-center py-6">No submissions yet.</p>
                                 ) : (
                                    <div className="text-center">
                                        <p className="mb-4">Upload your answer sheet for this assignment.</p>
                                        <Input type="file" onChange={e => { if (e.target.files?.[0]) handleAssignmentSubmit(e.target.files[0]) }} className="max-w-xs mx-auto"/>
                                    </div>
                                 )}
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                  <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                          <div>
                              <CardTitle>Assignments</CardTitle>
                              <CardDescription>View and submit your assignments.</CardDescription>
                          </div>
                          {isTeacher && (
                              <Dialog open={isAssignmentDialogOpen} onOpenChange={setIsAssignmentDialogOpen}>
                                  <DialogTrigger asChild>
                                      <Button onClick={() => handleOpenAssignmentDialog(null)}><PlusCircle className="mr-2 h-4 w-4"/>New Assignment</Button>
                                  </DialogTrigger>
                                  <AssignmentDialog classroomId={classroomId} onAssignmentAction={() => setIsAssignmentDialogOpen(false)} assignmentToEdit={editingAssignment} />
                              </Dialog>
                          )}
                      </CardHeader>
                      <CardContent>
                          {assignments.length > 0 ? (
                              <div className="space-y-2">
                                  {assignments.map(assignment => (
                                      <div key={assignment.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted group">
                                          <div className="flex items-center gap-3">
                                              <ClipboardList className="h-5 w-5 text-primary" />
                                              <div>
                                                  <a onClick={() => setSelectedAssignment(assignment)} className="font-medium text-foreground cursor-pointer hover:underline">{assignment.title}</a>
                                                  <p className="text-xs text-muted-foreground">
                                                      Due by {format(new Date(assignment.dueDate.seconds * 1000), 'MMM d, yyyy')}
                                                  </p>
                                              </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                               <Button variant="secondary" size="sm" onClick={() => setSelectedAssignment(assignment)}>View</Button>
                                              {isTeacher && (
                                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100" onClick={() => handleDeleteAssignment(assignment)}>
                                                      <Trash2 className="h-4 w-4"/>
                                                  </Button>
                                              )}
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          ) : (
                              <div className="text-center text-muted-foreground py-12">
                                  <ClipboardList className="h-12 w-12 mx-auto mb-2" />
                                  <p>No assignments posted yet.</p>
                              </div>
                          )}
                      </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="exams" className="mt-0">
                {selectedExam ? (
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedExam(null)} className="-ml-2"><ArrowLeft className="mr-2 h-4 w-4"/> Back to list</Button>
                                    <CardTitle className="mt-2">{selectedExam.title}</CardTitle>
                                    <CardDescription>Due: {format(new Date(selectedExam.endDate.seconds * 1000), "PPP")}</CardDescription>
                                </div>
                                {isTeacher && (
                                    <Button variant="outline" size="sm" onClick={() => handleOpenExamDialog(selectedExam)}><Edit className="mr-2 h-4 w-4"/> Edit</Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {selectedExam.description && <p className="mb-4 text-sm whitespace-pre-wrap">{selectedExam.description}</p>}
                             {selectedExam.fileURL && (
                                <Button asChild variant="secondary" className="mb-6"><a href={selectedExam.fileURL} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-4 w-4"/>Download Question Paper</a></Button>
                             )}

                            <div className="border-t pt-4">
                                <h3 className="font-semibold text-lg mb-2">{isTeacher ? "Student Submissions" : "Your Answer"}</h3>
                                 <Card className="bg-muted/50 p-6 text-center">
                                    {isTeacher ? (
                                        <div>
                                            <p>Student answers will appear here once submitted.</p>
                                            <p className="text-xs text-muted-foreground mt-1">This feature is under development.</p>
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="mb-4">Upload your answer sheet or type your response below.</p>
                                            <div className="flex justify-center gap-4">
                                                <Button><FileUp className="mr-2 h-4 w-4"/> Upload Answer</Button>
                                                <Button variant="outline">Type Answer</Button>
                                            </div>
                                        </div>
                                    )}
                                 </Card>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Exams</CardTitle>
                                <CardDescription>View upcoming and past exams.</CardDescription>
                            </div>
                            {isTeacher && (
                                <Dialog open={isExamDialogOpen} onOpenChange={setIsExamDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button onClick={() => handleOpenExamDialog(null)}><PlusCircle className="mr-2 h-4 w-4"/>New Exam</Button>
                                    </DialogTrigger>
                                    <ExamDialog classroomId={classroomId} onExamAction={() => setIsExamDialogOpen(false)} examToEdit={editingExam} />
                                </Dialog>
                            )}
                        </CardHeader>
                        <CardContent>
                            {displayedExams.length > 0 ? (
                                <div className="space-y-2">
                                    {displayedExams.map(exam => (
                                        <div key={exam.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted group">
                                            <div className="flex items-center gap-3">
                                                <FileText className="h-5 w-5 text-primary" />
                                                <div>
                                                    <a onClick={() => setSelectedExam(exam)} className="font-medium text-foreground cursor-pointer hover:underline">{exam.title}</a>
                                                    <p className="text-xs text-muted-foreground">
                                                        Due by {format(new Date(exam.endDate.seconds * 1000), 'MMM d, yyyy')}
                                                        {isTeacher && <span className={cn("ml-2 px-2 py-0.5 rounded-full text-xs", exam.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800')}>{exam.status}</span>}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                 <Button variant="secondary" size="sm" onClick={() => setSelectedExam(exam)}>View</Button>
                                                {isTeacher && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100" onClick={() => handleDeleteExam(exam)}>
                                                        <Trash2 className="h-4 w-4"/>
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-muted-foreground py-12">
                                    <FileText className="h-12 w-12 mx-auto mb-2" />
                                    <p>No exams posted yet.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
              </TabsContent>

              <TabsContent value="teachers" className="mt-0">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Subject Teachers</CardTitle>
                            <CardDescription>Teacher who created this class can add subject teachers from here also and can edit timing and all thing</CardDescription>
                        </div>
                        {isTeacher && (
                            <Dialog open={isTeacherDialogOpen} onOpenChange={setIsTeacherDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button onClick={() => handleOpenTeacherDialog(null)}><PlusCircle className="mr-2 h-4 w-4"/>Add Teacher</Button>
                                </DialogTrigger>
                                <TeacherDialog classroomId={classroomId} onAction={() => setIsTeacherDialogOpen(false)} teacherToEdit={editingTeacher} />
                            </Dialog>
                        )}
                    </CardHeader>
                    <CardContent>
                        {subjectTeachers.length > 0 ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {subjectTeachers.map(teacher => (
                                    <Card key={teacher.id} className="shadow-md group relative">
                                      <CardHeader className="flex flex-row items-start gap-4">
                                          <Avatar className="h-12 w-12 mt-1">
                                              <AvatarImage src={teacher.photoURL} data-ai-hint="avatar teacher"/>
                                              <AvatarFallback>{teacher.name.charAt(0)}</AvatarFallback>
                                          </Avatar>
                                          <div className="flex-grow">
                                            <CardTitle className="text-lg">{teacher.name}</CardTitle>
                                            <CardDescription>{teacher.subject}</CardDescription>
                                          </div>
                                           {isTeacher && (
                                              <div className="absolute top-2 right-2 flex opacity-0 group-hover:opacity-100 transition-opacity">
                                                  <Button variant="ghost" size="icon" onClick={() => handleOpenTeacherDialog(teacher)} className="h-7 w-7"><Edit className="h-4 w-4"/></Button>
                                                  <Button variant="ghost" size="icon" onClick={() => handleDeleteTeacher(teacher)} className="h-7 w-7 text-destructive"><Trash2 className="h-4 w-4"/></Button>
                                              </div>
                                          )}
                                      </CardHeader>
                                      <CardContent>
                                          <div className="flex items-center text-sm text-muted-foreground">
                                            <Clock className="h-4 w-4 mr-2" />
                                            <span>{teacher.timings || "Not specified"}</span>
                                          </div>
                                      </CardContent>
                                      <CardFooter>
                                        <Button className="w-full btn-gel">
                                          <HelpCircle className="mr-2 h-4 w-4" /> Ask a Question
                                        </Button>
                                      </CardFooter>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center text-muted-foreground py-12">
                                <Users className="h-12 w-12 mx-auto mb-2" />
                                <p>No subject teachers have been assigned to this class yet.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="fees" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div className="flex-grow">
                                <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5"/>Make a Payment</CardTitle>
                                <CardDescription>Pay your tuition and other fees securely.</CardDescription>
                            </div>
                            {isTeacher && (
                                <Dialog open={isEditFeeOpen} onOpenChange={setIsEditFeeOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="icon"><Edit className="h-4 w-4" /></Button>
                                    </DialogTrigger>
                                    {classroom && <EditFeeDialog classroom={classroom} onFeeUpdated={() => setIsEditFeeOpen(false)} />}
                                </Dialog>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="font-bold text-3xl">{feeAmountFormatted}</p>
                                <p className="text-sm text-muted-foreground">Due by: Dec 31, 2024</p>
                            </div>
                             <Dialog>
                                <DialogTrigger asChild>
                                    <Button className="w-full btn-gel">Pay Now</Button>
                                </DialogTrigger>
                                <PaymentDialog />
                            </Dialog>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><BadgeDollarSign className="h-5 w-5"/>Payment History</CardTitle>
                            <CardDescription>View your past transactions.</CardDescription>
                        </CardHeader>
                        <CardContent className="text-center text-muted-foreground py-8">
                             <p>No transaction history found.</p>
                        </CardContent>
                    </Card>
                </div>
              </TabsContent>

               <TabsContent value="chat" className="mt-0">
                <Card className="h-[600px] flex flex-col">
                    <CardHeader>
                        <CardTitle>Class Chat</CardTitle>
                        <CardDescription>Discuss topics with your classmates and teacher.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow p-0 overflow-hidden">
                        <ScrollArea className="h-full" ref={chatScrollAreaRef}>
                            <div className="p-4 space-y-4">
                                {chatMessages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground pt-16">
                                      <MessageSquare className="w-16 h-16 mb-4" />
                                      <p className="text-lg">No messages yet.</p>
                                      <p>Be the first to say hello!</p>
                                    </div>
                                ) : (
                                    chatMessages.map(msg => (
                                        <div key={msg.id} className={cn("flex items-end gap-2", msg.senderId === user?.uid ? "justify-end" : "justify-start")}>
                                          {msg.senderId !== user?.uid && (
                                              <Avatar className="h-8 w-8 self-start">
                                                  <AvatarImage src={msg.senderPhotoURL} data-ai-hint="avatar user"/>
                                                  <AvatarFallback>{msg.senderName.charAt(0)}</AvatarFallback>
                                              </Avatar>
                                          )}
                                          <div className={cn(
                                              "max-w-[70%] p-3 rounded-xl shadow",
                                              msg.senderId === user?.uid
                                              ? "bg-primary text-primary-foreground rounded-br-none"
                                              : "bg-card text-card-foreground rounded-bl-none"
                                          )}>
                                              {msg.senderId !== user?.uid && <p className="text-xs font-medium mb-0.5">{msg.senderName}</p>}
                                              <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                                              <p className="text-xs opacity-70 mt-1 text-right">{msg.createdAt ? formatDistanceToNow(new Date(msg.createdAt.seconds * 1000), { addSuffix: true }) : 'sending...'}</p>
                                          </div>
                                           {msg.senderId === user?.uid && (
                                              <Avatar className="h-8 w-8 self-start">
                                                  <AvatarImage src={user?.photoURL ?? ''} data-ai-hint="avatar user"/>
                                                  <AvatarFallback>{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                                              </Avatar>
                                          )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                    <CardFooter className="p-4 border-t bg-background">
                        <form
                            onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                            className="flex w-full items-center gap-2"
                        >
                            <Input
                                value={newChatMessage}
                                onChange={(e) => setNewChatMessage(e.target.value)}
                                placeholder="Type your message..."
                                className="flex-grow rounded-lg text-base"
                                disabled={isSendingMessage}
                            />
                            <Button type="submit" size="icon" className="rounded-lg btn-gel w-10 h-10" disabled={isSendingMessage || !newChatMessage.trim()}>
                                {isSendingMessage ? <Loader2 className="h-5 w-5 animate-spin"/> : <Send className="h-5 w-5" />}
                                <span className="sr-only">Send message</span>
                            </Button>
                        </form>
                    </CardFooter>
                </Card>
              </TabsContent>
          </div>
        </Tabs>
    </div>
  );
}

    