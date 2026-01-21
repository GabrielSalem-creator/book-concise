import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AzureVoice {
  name: string;
  displayName: string;
  localName: string;
  gender: 'Male' | 'Female';
  locale: string;
  voiceType: string;
  styleList: string[];
}

interface UseAzureTTSOptions {
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export const useAzureTTS = (options: UseAzureTTSOptions = {}) => {
  const { toast } = useToast();
  const [voices, setVoices] = useState<AzureVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('en-US-AvaNeural');
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [voicesLoaded, setVoicesLoaded] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Load available voices
  const loadVoices = useCallback(async () => {
    if (voicesLoaded) return;
    
    try {
      setIsLoading(true);
      console.log('Loading Azure TTS voices...');
      
      const { data, error } = await supabase.functions.invoke('azure-tts', {
        body: { action: 'getVoices' }
      });

      if (error) {
        console.error('Error loading voices:', error);
        throw new Error(error.message);
      }

      if (data?.voices) {
        setVoices(data.voices);
        setVoicesLoaded(true);
        console.log(`Loaded ${data.voices.length} Azure voices`);
        
        // Select a good default voice (Ava is great quality)
        const ava = data.voices.find((v: AzureVoice) => v.name === 'en-US-AvaNeural');
        if (ava) {
          setSelectedVoice(ava.name);
        }
      }
    } catch (error: any) {
      console.error('Failed to load voices:', error);
      toast({
        title: "Voice Loading Failed",
        description: "Could not load Azure voices. Using default.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [voicesLoaded, toast]);

  // Generate and play audio
  const speak = useCallback(async (text: string, voiceName?: string) => {
    if (!text.trim()) {
      toast({
        title: "No Text",
        description: "Please provide text to read",
        variant: "destructive",
      });
      return;
    }

    // Stop any existing audio
    stop();

    try {
      setIsLoading(true);
      setProgress(0);

      console.log(`Generating speech with voice: ${voiceName || selectedVoice}`);

      const { data, error } = await supabase.functions.invoke('azure-tts', {
        body: {
          action: 'speak',
          text: text,
          voiceName: voiceName || selectedVoice,
          rate: '1.0',
          pitch: '0%'
        }
      });

      if (error) {
        console.error('TTS error:', error);
        throw new Error(error.message);
      }

      if (!data?.audio) {
        throw new Error('No audio returned');
      }

      // Convert base64 to audio blob
      const binaryString = atob(data.audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);

      // Create and play audio
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.addEventListener('timeupdate', () => {
        if (audio.duration > 0) {
          const currentProgress = (audio.currentTime / audio.duration) * 100;
          setProgress(currentProgress);
          options.onProgress?.(currentProgress);
        }
      });

      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        setIsPaused(false);
        setProgress(100);
        options.onComplete?.();
        URL.revokeObjectURL(audioUrl);
      });

      audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        setIsPlaying(false);
        setIsLoading(false);
        options.onError?.('Audio playback failed');
        toast({
          title: "Playback Error",
          description: "Could not play the audio",
          variant: "destructive",
        });
      });

      await audio.play();
      setIsPlaying(true);
      setIsLoading(false);

    } catch (error: any) {
      console.error('Speech generation failed:', error);
      setIsLoading(false);
      setIsPlaying(false);
      options.onError?.(error.message);
      toast({
        title: "Speech Failed",
        description: error.message || "Could not generate speech",
        variant: "destructive",
      });
    }
  }, [selectedVoice, options, toast]);

  // Pause audio
  const pause = useCallback(() => {
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      setIsPaused(true);
    }
  }, [isPlaying]);

  // Resume audio
  const resume = useCallback(() => {
    if (audioRef.current && isPaused) {
      audioRef.current.play();
      setIsPlaying(true);
      setIsPaused(false);
    }
  }, [isPaused]);

  // Stop audio
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
  }, []);

  // Seek to position
  const seekTo = useCallback((percentage: number) => {
    if (audioRef.current && audioRef.current.duration > 0) {
      const time = (percentage / 100) * audioRef.current.duration;
      audioRef.current.currentTime = time;
      setProgress(percentage);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    // State
    voices,
    selectedVoice,
    isLoading,
    isPlaying,
    isPaused,
    progress,
    voicesLoaded,
    
    // Actions
    loadVoices,
    setSelectedVoice,
    speak,
    pause,
    resume,
    stop,
    seekTo,
  };
};
