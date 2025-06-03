
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Languages as LanguagesIcon, Mic, MicOff, Square, Loader2, AlertCircle, Play, Volume2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { translateAndSpeak, TranslateAndSpeakInput, TranslateAndSpeakOutput } from '@/ai/flows/translate-and-speak-flow';
import { cn } from '@/lib/utils';

const languageOptions = [
  { value: "en-US", label: "English (US)" },
  { value: "hi-IN", label: "Hindi (India)" },
  { value: "es-ES", label: "Spanish (Spain)" },
  { value: "fr-FR", label: "French (France)" },
  { value: "de-DE", label: "German (Germany)" },
  { value: "ja-JP", label: "Japanese (Japan)" },
  { value: "ko-KR", label: "Korean (South Korea)" },
];

const ttsVoiceOptions = [
  { value: "neutral", label: "Neutral" },
  { value: "female", label: "Girl / Female" },
  { value: "male", label: "Boy / Male" },
];

interface TranslateAndSpeakDialogContentProps {
  audioPlayerRef: React.RefObject<HTMLAudioElement>;
}

type RecordingState = 'idle' | 'recording' | 'processing' | 'error' | 'success';

export function TranslateAndSpeakDialogContent({ audioPlayerRef }: TranslateAndSpeakDialogContentProps) {
  const [sourceLanguage, setSourceLanguage] = useState('en-US');
  const [targetLanguage, setTargetLanguage] = useState('es-ES');
  const [playbackVoice, setPlaybackVoice] = useState<'neutral' | 'female' | 'male'>('neutral');
  
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordedAudioDataUri, setRecordedAudioDataUri] = useState<string | null>(null);
  
  const [originalTranscriptionResult, setOriginalTranscriptionResult] = useState('');
  const [translatedTextResult, setTranslatedTextResult] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);


  useEffect(() => {
    const savedSpokenLang = localStorage.getItem("teachmeet-default-spoken-language") || 'en-US';
    const savedTranslationLang = localStorage.getItem("teachmeet-preferred-translation-language") || 'es-ES';
    const savedTTSVoice = (localStorage.getItem("teachmeet-preferred-tts-voice") || 'neutral') as 'neutral' | 'female' | 'male';
    
    setSourceLanguage(savedSpokenLang);
    setTargetLanguage(savedTranslationLang);
    setPlaybackVoice(savedTTSVoice);

    // Clean up media stream on unmount
    return () => {
        stopRecording(false); // Stop any active recording
        micStreamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const startRecording = async () => {
    setRecordingState('recording');
    setError(null);
    setOriginalTranscriptionResult('');
    setTranslatedTextResult('');
    setRecordedAudioDataUri(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' }); // Common format

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          setRecordedAudioDataUri(base64String);
          processRecordedAudio(base64String);
        };
        reader.readAsDataURL(audioBlob);
        audioChunksRef.current = [];
        micStreamRef.current?.getTracks().forEach(track => track.stop()); // Release mic
      };

      mediaRecorderRef.current.start();
      toast({ title: "Recording Started", description: "Speak into your microphone." });
    } catch (err) {
      console.error("Error starting recording:", err);
      setError("Could not start recording. Please ensure microphone permission is granted and your mic is working.");
      setRecordingState('error');
      toast({ variant: 'destructive', title: 'Recording Error', description: 'Failed to access microphone.' });
    }
  };

  const stopRecording = (process: boolean = true) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop(); // onstop will handle processing if process is true
      if (process) {
        setRecordingState('processing');
        toast({ title: "Recording Stopped", description: "Processing your audio..." });
      } else {
        setRecordingState('idle');
      }
    }
    micStreamRef.current?.getTracks().forEach(track => track.stop()); // Ensure mic is released
  };

  const processRecordedAudio = async (audioDataUri: string) => {
    setRecordingState('processing');
    setError(null);

    const input: TranslateAndSpeakInput = {
      audioDataUri: audioDataUri,
      sourceLanguageCode: sourceLanguage,
      targetLanguageCode: targetLanguage,
      voiceGender: playbackVoice,
    };

    try {
      const result: TranslateAndSpeakOutput = await translateAndSpeak(input);
      
      if (result.confirmationMessage.toLowerCase().includes('error') || result.confirmationMessage.toLowerCase().includes('failed')) {
         setError(result.confirmationMessage);
         setRecordingState('error');
         toast({ variant: 'destructive', title: 'Processing Error', description: result.confirmationMessage, duration: 7000 });
      } else {
        setOriginalTranscriptionResult(result.originalTranscription);
        setTranslatedTextResult(result.translatedText);
        setRecordingState('success');
        toast({ title: 'Success', description: result.confirmationMessage, duration: 5000 });

        if (audioPlayerRef.current && result.audioDataUri) {
            if (result.audioDataUri === "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAIARKwAABCxAgAEABAAZGF0YQIAAAD//w==" && result.confirmationMessage.includes("Error")) {
                // Don't attempt to play if it was an error and we got silent audio
            } else {
                audioPlayerRef.current.src = result.audioDataUri;
                audioPlayerRef.current.play().catch(playError => {
                    console.error("Error playing audio:", playError);
                    toast({ variant: 'destructive', title: 'Playback Error', description: 'Could not play the translated audio automatically.', duration: 7000 });
                });
            }
        }
      }
    } catch (e: any) {
      const errorMessage = e.message || "An unknown error occurred during processing.";
      setError(errorMessage);
      setRecordingState('error');
      toast({ variant: 'destructive', title: 'Processing Error', description: errorMessage, duration: 7000 });
      console.error("Translate and Speak Error (Audio Input):", e);
    }
  };
  
  const handlePlayOriginal = () => {
    if (recordedAudioDataUri && audioPlayerRef.current) {
        audioPlayerRef.current.src = recordedAudioDataUri;
        audioPlayerRef.current.play().catch(e => console.error("Error playing original audio:", e));
    } else {
        toast({variant: 'destructive', title: 'No Audio', description: 'No recorded audio available to play.'});
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center">
          <LanguagesIcon className="mr-2 h-6 w-6 text-primary" />
          AI Audio Language Translator
        </DialogTitle>
        <DialogDescription>
          Record your voice, select languages, and hear the translation. (Speech-to-Text is simulated).
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
        <div className="flex flex-col items-center space-y-3">
            {recordingState === 'idle' && (
                <Button onClick={startRecording} className="btn-gel rounded-lg px-6 py-3 text-base">
                    <Mic className="mr-2 h-5 w-5" /> Start Recording
                </Button>
            )}
            {recordingState === 'recording' && (
                <Button onClick={() => stopRecording(true)} variant="destructive" className="rounded-lg px-6 py-3 text-base">
                    <Square className="mr-2 h-5 w-5" /> Stop Recording
                </Button>
            )}
            {recordingState === 'processing' && (
                <Button className="rounded-lg px-6 py-3 text-base" disabled>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...
                </Button>
            )}
            {(recordingState === 'success' || recordingState === 'error') && recordingState !== 'recording' && (
                 <Button onClick={startRecording} className="btn-gel rounded-lg px-6 py-3 text-base">
                    <Mic className="mr-2 h-5 w-5" /> Record Again
                </Button>
            )}
            {recordingState === 'recording' && <p className="text-sm text-muted-foreground animate-pulse">Recording audio...</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
                <Label htmlFor="source-language">Source Language (Your Voice)</Label>
                <Select value={sourceLanguage} onValueChange={setSourceLanguage} disabled={recordingState === 'recording' || recordingState === 'processing'}>
                <SelectTrigger id="source-language" className="mt-1 rounded-lg">
                    <SelectValue placeholder="Select source language" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                    {languageOptions.map(lang => (
                    <SelectItem key={`src-${lang.value}`} value={lang.value} className="rounded-md">{lang.label}</SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>
            <div>
                <Label htmlFor="target-language">Target Language (Translation)</Label>
                <Select value={targetLanguage} onValueChange={setTargetLanguage} disabled={recordingState === 'recording' || recordingState === 'processing'}>
                <SelectTrigger id="target-language" className="mt-1 rounded-lg">
                    <SelectValue placeholder="Select target language" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                    {languageOptions.map(lang => (
                    <SelectItem key={`tgt-${lang.value}`} value={lang.value} className="rounded-md">{lang.label}</SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>
        </div>
        <div>
          <Label htmlFor="playback-voice">Voice for Translated Playback</Label>
          <Select value={playbackVoice} onValueChange={(val) => setPlaybackVoice(val as 'neutral'|'female'|'male')} disabled={recordingState === 'recording' || recordingState === 'processing'}>
            <SelectTrigger id="playback-voice" className="mt-1 rounded-lg">
              <SelectValue placeholder="Select voice" />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              {ttsVoiceOptions.map(voice => (
                <SelectItem key={voice.value} value={voice.value} className="rounded-md">{voice.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {originalTranscriptionResult && (
          <div className="space-y-1 pt-2">
            <div className="flex justify-between items-center">
                <Label htmlFor="original-transcription-output">Original Transcription (Simulated):</Label>
                {recordedAudioDataUri && 
                    <Button variant="ghost" size="sm" onClick={handlePlayOriginal} className="text-xs rounded-md" title="Play original recording">
                        <Play className="mr-1 h-3 w-3"/> Play Original
                    </Button>
                }
            </div>
            <Textarea
              id="original-transcription-output"
              value={originalTranscriptionResult}
              readOnly
              className="mt-1 rounded-lg min-h-[60px] bg-muted/50"
            />
          </div>
        )}

        {translatedTextResult && (
          <div className="space-y-1 pt-2">
            <Label htmlFor="translated-text-output">Translated Text:</Label>
            <Textarea
              id="translated-text-output"
              value={translatedTextResult}
              readOnly
              className="mt-1 rounded-lg min-h-[80px] bg-muted/50"
            />
          </div>
        )}
        {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-2">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5"/>
                <span>{error}</span>
            </div>
        )}
      </div>
      <DialogFooter className="gap-2 sm:gap-0">
        <DialogClose asChild>
          <Button type="button" variant="outline" className="rounded-lg" onClick={() => stopRecording(false)} disabled={recordingState === 'processing'}>
            Cancel
          </Button>
        </DialogClose>
        {/* The main action button is dynamic (record/stop/processing) so no separate submit here */}
      </DialogFooter>
    </>
  );
}
