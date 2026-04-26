import { useState, useRef, useCallback } from 'react';
import { Mic, Loader2, AlertCircle } from 'lucide-react';
import { Button, Tooltip } from '@nextui-org/react';
import { transcribeAudio, isGroqSttAvailable } from '../services/groqStt';
import { useToast } from '../hooks/useToast';

interface VoiceInputProps {
  /** Called with the transcribed text when ready */
  onTranscript: (text: string) => void;
  /** Optional additional className for the button */
  className?: string;
  /** Append mode: if true, transcript is appended to existing text with a space */
  append?: boolean;
  /** Current text value (for append mode) */
  currentText?: string;
}

type RecordingState = 'idle' | 'recording' | 'processing' | 'error';

export default function VoiceInput({ onTranscript, className = '', append = false, currentText = '' }: VoiceInputProps) {
  const { error: toastError } = useToast();
  const [state, setState] = useState<RecordingState>('idle');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);

  const startRecording = useCallback(async () => {
    if (!isGroqSttAvailable()) {
      toastError('Voice input unavailable', 'Add VITE_GROQ_API_KEY to client/.env to enable speech-to-text.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Stop all tracks to release the mic
        stream.getTracks().forEach((t) => t.stop());

        const duration = Date.now() - startTimeRef.current;
        if (duration < 500 || chunksRef.current.length === 0) {
          setState('idle');
          return;
        }

        setState('processing');
        const blob = new Blob(chunksRef.current, { type: mimeType });

        try {
          const text = await transcribeAudio(blob);
          if (text.trim()) {
            const finalText = append && currentText.trim()
              ? `${currentText.trim()} ${text.trim()}`
              : text.trim();
            onTranscript(finalText);
          }
          setState('idle');
        } catch (err: any) {
          setState('error');
          toastError('Transcription failed', err?.message ?? 'Could not transcribe audio');
          setTimeout(() => setState('idle'), 2000);
        }
      };

      recorder.start(100); // collect data every 100ms
      setState('recording');

      // Auto-stop after 60 seconds to prevent runaway recording
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, 60000);
    } catch (err: any) {
      toastError('Microphone access denied', 'Please allow microphone access in your browser settings.');
      setState('idle');
    }
  }, [append, currentText, onTranscript, toastError]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (state === 'recording') {
      stopRecording();
    } else if (state === 'idle' || state === 'error') {
      startRecording();
    }
  }, [state, startRecording, stopRecording]);

  const tooltipContent = !isGroqSttAvailable()
    ? 'Speech-to-text not configured'
    : state === 'recording'
      ? 'Click to stop recording'
      : state === 'processing'
        ? 'Transcribing...'
        : 'Describe with your voice';

  return (
    <Tooltip content={tooltipContent} placement="top">
      <Button
        isIconOnly
        size="sm"
        variant={state === 'recording' ? 'solid' : 'light'}
        color={state === 'error' ? 'danger' : state === 'recording' ? 'danger' : 'primary'}
        className={`
          relative transition-all duration-200
          ${state === 'recording' ? 'animate-pulse bg-rose-500' : ''}
          ${className}
        `}
        isDisabled={state === 'processing'}
        onPress={toggleRecording}
      >
        {state === 'processing' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : state === 'error' ? (
          <AlertCircle className="w-4 h-4" />
        ) : (
          <Mic className={`w-4 h-4 ${state === 'recording' ? 'text-white' : ''}`} />
        )}
        {state === 'recording' && (
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
          </span>
        )}
      </Button>
    </Tooltip>
  );
}
