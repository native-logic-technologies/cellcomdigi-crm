/**
 * GroqCloud Speech-to-Text (STT) service
 * Uses Groq's Whisper API for near-instant transcription.
 * https://console.groq.com/docs/speech-text
 */

const GROQ_API_KEY = (import.meta as any).env?.VITE_GROQ_API_KEY;
const GROQ_STT_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

export interface TranscriptionResult {
  text: string;
}

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not configured. Add VITE_GROQ_API_KEY to client/.env');
  }

  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model', 'whisper-large-v3');
  formData.append('response_format', 'json');
  // Optional: specify language for better accuracy
  // formData.append('language', 'en');

  const response = await fetch(GROQ_STT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq STT error (${response.status}): ${error}`);
  }

  const data: TranscriptionResult = await response.json();
  return data.text ?? '';
}

export function isGroqSttAvailable(): boolean {
  return !!GROQ_API_KEY;
}
