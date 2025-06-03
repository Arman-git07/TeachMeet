
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Languages as LanguagesIcon, Volume2, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { translateAndSpeak, TranslateAndSpeakInput, TranslateAndSpeakOutput } from '@/ai/flows/translate-and-speak-flow';

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

export function TranslateAndSpeakDialogContent({ audioPlayerRef }: TranslateAndSpeakDialogContentProps) {
  const [textToTranslate, setTextToTranslate] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('en-US');
  const [targetLanguage, setTargetLanguage] = useState('es-ES');
  const [playbackVoice, setPlaybackVoice] = useState<'neutral' | 'female' | 'male'>('neutral');
  const [translatedTextResult, setTranslatedTextResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Load preferences from localStorage
    const savedSpokenLang = localStorage.getItem("teachmeet-default-spoken-language") || 'en-US';
    const savedTranslationLang = localStorage.getItem("teachmeet-preferred-translation-language") || 'es-ES';
    const savedTTSVoice = (localStorage.getItem("teachmeet-preferred-tts-voice") || 'neutral') as 'neutral' | 'female' | 'male';
    
    setSourceLanguage(savedSpokenLang);
    setTargetLanguage(savedTranslationLang);
    setPlaybackVoice(savedTTSVoice);
  }, []);

  const handleTranslateAndSpeak = async () => {
    if (!textToTranslate.trim()) {
      toast({ variant: 'destructive', title: 'Input Required', description: 'Please enter some text to translate.' });
      return;
    }
    setIsLoading(true);
    setError(null);
    setTranslatedTextResult('');

    const input: TranslateAndSpeakInput = {
      textToTranslate: textToTranslate.trim(),
      sourceLanguageCode: sourceLanguage,
      targetLanguageCode: targetLanguage,
      voiceGender: playbackVoice,
    };

    try {
      const result: TranslateAndSpeakOutput = await translateAndSpeak(input);
      
      if (result.confirmationMessage.toLowerCase().includes('error') || result.confirmationMessage.toLowerCase().includes('failed')) {
         setError(result.confirmationMessage);
         toast({ variant: 'destructive', title: 'Translation/Speech Error', description: result.confirmationMessage, duration: 7000 });
      } else {
        setTranslatedTextResult(result.translatedText);
        toast({ title: 'Success', description: result.confirmationMessage, duration: 5000 });

        if (audioPlayerRef.current && result.audioDataUri) {
            // Check if audioDataUri is the default silent one, or a real one
            if (result.audioDataUri === "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAIARKwAABCxAgAEABAAZGF0YQIAAAD//w==" && result.confirmationMessage.includes("Error")) {
                // Don't attempt to play if it was an error and we got silent audio
            } else {
                audioPlayerRef.current.src = result.audioDataUri;
                audioPlayerRef.current.play().catch(playError => {
                    console.error("Error playing audio:", playError);
                    toast({ variant: 'destructive', title: 'Playback Error', description: 'Could not play the audio automatically. Please ensure your browser allows autoplay or check console.', duration: 7000 });
                });
            }
        }
      }
    } catch (e: any) {
      const errorMessage = e.message || "An unknown error occurred during translation and speech synthesis.";
      setError(errorMessage);
      toast({ variant: 'destructive', title: 'Processing Error', description: errorMessage, duration: 7000 });
      console.error("Translate and Speak Error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center">
          <LanguagesIcon className="mr-2 h-6 w-6 text-primary" />
          AI Translator & Speaker
        </DialogTitle>
        <DialogDescription>
          Translate text to another language and hear it spoken.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
        <div>
          <Label htmlFor="text-to-translate">Text to Translate</Label>
          <Textarea
            id="text-to-translate"
            placeholder="Enter text here..."
            value={textToTranslate}
            onChange={(e) => setTextToTranslate(e.target.value)}
            className="mt-1 rounded-lg min-h-[100px]"
            disabled={isLoading}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
                <Label htmlFor="source-language">Source Language</Label>
                <Select value={sourceLanguage} onValueChange={setSourceLanguage} disabled={isLoading}>
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
                <Label htmlFor="target-language">Target Language</Label>
                <Select value={targetLanguage} onValueChange={setTargetLanguage} disabled={isLoading}>
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
          <Label htmlFor="playback-voice">Voice for Playback</Label>
          <Select value={playbackVoice} onValueChange={(val) => setPlaybackVoice(val as 'neutral'|'female'|'male')} disabled={isLoading}>
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
          <Button type="button" variant="outline" className="rounded-lg" disabled={isLoading}>
            Cancel
          </Button>
        </DialogClose>
        <Button
          type="button"
          onClick={handleTranslateAndSpeak}
          className="btn-gel rounded-lg"
          disabled={isLoading || !textToTranslate.trim()}
        >
          {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Volume2 className="mr-2 h-5 w-5" />}
          {isLoading ? 'Processing...' : 'Translate & Speak'}
        </Button>
      </DialogFooter>
    </>
  );
}
