import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ChunkData {
  chunk_index: number;
  audio_base64: string;
}

interface UseChunkedAudioPlayerOptions {
  bookId: string | undefined;
  voiceName: string;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export function useChunkedAudioPlayer({
  bookId,
  voiceName,
  onProgress,
  onComplete,
  onError,
}: UseChunkedAudioPlayerOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [chunksLoaded, setChunksLoaded] = useState(false);
  const [totalChunks, setTotalChunks] = useState(0);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);

  const chunksRef = useRef<ChunkData[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentBlobUrlRef = useRef<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (currentBlobUrlRef.current) {
      URL.revokeObjectURL(currentBlobUrlRef.current);
      currentBlobUrlRef.current = null;
    }
  }, []);

  // Load chunks from database
  const loadChunks = useCallback(async (): Promise<boolean> => {
    if (!bookId) return false;

    setIsLoading(true);
    console.log('[ChunkedPlayer] Loading chunks for', bookId, voiceName);

    try {
      const { data, error } = await supabase.functions.invoke('generate-audio-chunks', {
        body: { action: 'getChunks', bookId, voiceName }
      });

      if (error) {
        console.error('[ChunkedPlayer] Error loading chunks:', error);
        setIsLoading(false);
        return false;
      }

      if (data?.chunks && data.chunks.length > 0) {
        chunksRef.current = data.chunks;
        setTotalChunks(data.chunks.length);
        setChunksLoaded(true);
        setIsLoading(false);
        console.log('[ChunkedPlayer] Loaded', data.chunks.length, 'chunks');
        return true;
      }

      // No chunks yet, trigger generation
      console.log('[ChunkedPlayer] No chunks found, triggering generation');
      await supabase.functions.invoke('generate-audio-chunks', {
        body: { action: 'generate', bookId, voiceName }
      });

      setIsLoading(false);
      return false;
    } catch (err) {
      console.error('[ChunkedPlayer] Load failed:', err);
      setIsLoading(false);
      return false;
    }
  }, [bookId, voiceName]);

  // Play a single chunk
  const playChunk = useCallback(async (chunkIndex: number): Promise<boolean> => {
    if (chunkIndex >= chunksRef.current.length) {
      console.log('[ChunkedPlayer] All chunks played');
      setIsPlaying(false);
      setProgress(100);
      onComplete?.();
      return false;
    }

    const chunk = chunksRef.current[chunkIndex];
    if (!chunk?.audio_base64) {
      console.error('[ChunkedPlayer] Invalid chunk at index', chunkIndex);
      return false;
    }

    cleanup();

    try {
      // Convert base64 to blob
      const binaryString = atob(chunk.audio_base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      const blobUrl = URL.createObjectURL(blob);
      currentBlobUrlRef.current = blobUrl;

      const audio = new Audio(blobUrl);
      audio.playbackRate = playbackRate;
      audioRef.current = audio;

      return new Promise((resolve) => {
        audio.oncanplaythrough = async () => {
          try {
            await audio.play();
            setCurrentChunkIndex(chunkIndex);
            setIsPlaying(true);
            setIsPaused(false);
            resolve(true);
          } catch (e) {
            console.error('[ChunkedPlayer] Play failed:', e);
            onError?.('Failed to play audio chunk');
            resolve(false);
          }
        };

        audio.ontimeupdate = () => {
          if (audio.duration > 0) {
            // Calculate overall progress across all chunks
            const chunkProgress = audio.currentTime / audio.duration;
            const overallProgress = ((chunkIndex + chunkProgress) / chunksRef.current.length) * 100;
            setProgress(overallProgress);
            onProgress?.(overallProgress);
          }
        };

        audio.onended = () => {
          // Play next chunk
          playChunk(chunkIndex + 1);
        };

        audio.onerror = () => {
          console.error('[ChunkedPlayer] Audio error on chunk', chunkIndex);
          // Try next chunk
          playChunk(chunkIndex + 1);
        };

        audio.load();
      });
    } catch (err) {
      console.error('[ChunkedPlayer] Chunk playback error:', err);
      onError?.('Failed to process audio chunk');
      return false;
    }
  }, [playbackRate, onProgress, onComplete, onError, cleanup]);

  // Start playback
  const play = useCallback(async () => {
    // Resume if paused
    if (isPaused && audioRef.current) {
      try {
        await audioRef.current.play();
        setIsPaused(false);
        setIsPlaying(true);
        return true;
      } catch (e) {
        console.error('[ChunkedPlayer] Resume failed:', e);
      }
    }

    // Load chunks if needed
    if (!chunksLoaded || chunksRef.current.length === 0) {
      const loaded = await loadChunks();
      if (!loaded) {
        onError?.('Audio chunks not ready yet. Please wait and try again.');
        return false;
      }
    }

    // Start from beginning or current chunk
    return await playChunk(currentChunkIndex);
  }, [isPaused, chunksLoaded, loadChunks, playChunk, currentChunkIndex, onError]);

  // Pause playback
  const pause = useCallback(() => {
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      setIsPaused(true);
    }
  }, [isPlaying]);

  // Stop playback
  const stop = useCallback(() => {
    cleanup();
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
    setCurrentChunkIndex(0);
  }, [cleanup]);

  // Change playback speed
  const changeSpeed = useCallback((rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, []);

  // Seek to specific chunk
  const seekToChunk = useCallback(async (chunkIndex: number) => {
    if (chunkIndex >= 0 && chunkIndex < chunksRef.current.length) {
      await playChunk(chunkIndex);
    }
  }, [playChunk]);

  // Skip forward/backward
  const skip = useCallback(async (direction: 'forward' | 'backward') => {
    const newIndex = direction === 'forward' 
      ? Math.min(currentChunkIndex + 1, chunksRef.current.length - 1)
      : Math.max(currentChunkIndex - 1, 0);
    
    if (newIndex !== currentChunkIndex) {
      await playChunk(newIndex);
    }
  }, [currentChunkIndex, playChunk]);

  // Reload chunks (e.g., when voice changes)
  const reload = useCallback(async () => {
    cleanup();
    setChunksLoaded(false);
    setCurrentChunkIndex(0);
    setProgress(0);
    chunksRef.current = [];
    await loadChunks();
  }, [cleanup, loadChunks]);

  return {
    // State
    isLoading,
    isPlaying,
    isPaused,
    progress,
    playbackRate,
    chunksLoaded,
    totalChunks,
    currentChunkIndex,

    // Actions
    play,
    pause,
    stop,
    changeSpeed,
    seekToChunk,
    skip,
    reload,
    loadChunks,
  };
}
