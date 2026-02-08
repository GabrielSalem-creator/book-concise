import { useState, useCallback, useRef, useEffect } from 'react';

export interface WebSpeechVoice {
  name: string;
  lang: string;
  localService: boolean;
  voiceURI: string;
}

interface UseWebSpeechOptions {
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export const useWebSpeech = (options: UseWebSpeechOptions = {}) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [voicesLoaded, setVoicesLoaded] = useState(false);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const textRef = useRef<string>('');
  const progressIntervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Load available voices
  const loadVoices = useCallback(() => {
    if (!('speechSynthesis' in window)) {
      console.error('Web Speech API not supported');
      return;
    }

    const loadAvailableVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        // Filter to English voices and prioritize Google voices
        const englishVoices = availableVoices
          .filter(v => v.lang.startsWith('en'))
          .sort((a, b) => {
            // Prioritize Google voices
            const aGoogle = a.name.toLowerCase().includes('google');
            const bGoogle = b.name.toLowerCase().includes('google');
            if (aGoogle && !bGoogle) return -1;
            if (!aGoogle && bGoogle) return 1;
            // Then prioritize local service voices
            if (a.localService && !b.localService) return -1;
            if (!a.localService && b.localService) return 1;
            return a.name.localeCompare(b.name);
          });

        setVoices(englishVoices.length > 0 ? englishVoices : availableVoices);
        setVoicesLoaded(true);

        // Select default voice (prefer Google US English)
        const googleUs = englishVoices.find(v => 
          v.name.toLowerCase().includes('google') && v.lang === 'en-US'
        );
        const anyEnglish = englishVoices[0];
        const defaultVoice = googleUs || anyEnglish || availableVoices[0];
        
        if (defaultVoice && !selectedVoice) {
          setSelectedVoice(defaultVoice.name);
        }

        console.log(`Loaded ${availableVoices.length} voices, ${englishVoices.length} English`);
      }
    };

    // Voices may not be immediately available
    loadAvailableVoices();
    
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadAvailableVoices;
    }
  }, [selectedVoice]);

  // Initialize voices on mount
  useEffect(() => {
    loadVoices();
    return () => {
      stop();
    };
  }, []);

  // Estimate duration based on word count (~150 words per minute)
  const estimateDuration = (text: string): number => {
    const words = text.split(/\s+/).length;
    return (words / 150) * 60 * 1000; // milliseconds
  };

  // Start speaking
  const speak = useCallback((text: string, voiceName?: string) => {
    if (!('speechSynthesis' in window)) {
      options.onError?.('Web Speech API not supported in this browser');
      return;
    }

    if (!text.trim()) {
      options.onError?.('No text to speak');
      return;
    }

    // Stop any current speech
    stop();

    setIsLoading(true);
    textRef.current = text;

    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;

    // Find and set voice
    const voiceToUse = voiceName || selectedVoice;
    const voice = voices.find(v => v.name === voiceToUse);
    if (voice) {
      utterance.voice = voice;
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Event handlers
    utterance.onstart = () => {
      setIsLoading(false);
      setIsPlaying(true);
      setIsPaused(false);
      startTimeRef.current = Date.now();

      // Start progress tracking
      const estimatedDuration = estimateDuration(text);
      progressIntervalRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        const currentProgress = Math.min((elapsed / estimatedDuration) * 100, 99);
        setProgress(currentProgress);
        options.onProgress?.(currentProgress);
      }, 500);
    };

    utterance.onend = () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setIsPlaying(false);
      setIsPaused(false);
      setProgress(100);
      options.onComplete?.();
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setIsLoading(false);
      setIsPlaying(false);
      options.onError?.(event.error || 'Speech synthesis failed');
    };

    utterance.onpause = () => {
      setIsPlaying(false);
      setIsPaused(true);
    };

    utterance.onresume = () => {
      setIsPlaying(true);
      setIsPaused(false);
      startTimeRef.current = Date.now() - (progress / 100) * estimateDuration(text);
    };

    window.speechSynthesis.speak(utterance);
  }, [selectedVoice, voices, options, progress]);

  // Pause speech
  const pause = useCallback(() => {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
      setIsPaused(true);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }
  }, []);

  // Resume speech
  const resume = useCallback(() => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPlaying(true);
      setIsPaused(false);
      
      // Restart progress tracking
      const estimatedDuration = estimateDuration(textRef.current);
      const remainingTime = ((100 - progress) / 100) * estimatedDuration;
      startTimeRef.current = Date.now() - (progress / 100) * estimatedDuration;
      
      progressIntervalRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        const currentProgress = Math.min((elapsed / estimatedDuration) * 100, 99);
        setProgress(currentProgress);
        options.onProgress?.(currentProgress);
      }, 500);
    }
  }, [progress, options]);

  // Stop speech
  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    utteranceRef.current = null;
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
    setIsLoading(false);
  }, []);

  // Change playback rate
  const setRate = useCallback((rate: number) => {
    if (utteranceRef.current) {
      utteranceRef.current.rate = rate;
    }
  }, []);

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
    setRate,
  };
};
