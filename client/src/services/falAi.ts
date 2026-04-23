// FAL.ai Flux 2 Image Generation Service
// https://fal.ai/models/fal-ai/flux/dev

const API_URL = 'https://queue.fal.run/fal-ai/flux/dev';

function getApiKey(): string | null {
  return (import.meta as any).env?.VITE_FAL_API_KEY || localStorage.getItem('fal_api_key') || null;
}

export interface FalImageResult {
  url: string;
  width: number;
  height: number;
}

export async function generateImage(
  prompt: string,
  options: {
    aspectRatio?: '9:16' | '1:1' | '4:5' | '16:9';
    style?: 'photorealistic' | 'illustration' | '3d' | 'minimal';
  } = {}
): Promise<FalImageResult> {
  const apiKey = getApiKey();

  if (!apiKey) {
    // Fallback: return a placeholder from picsum with seed based on prompt
    const seed = prompt.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return {
      url: `https://picsum.photos/seed/${seed}/512/768`,
      width: 512,
      height: 768,
    };
  }

  const aspectRatioMap: Record<string, string> = {
    '9:16': '9:16',
    '1:1': '1:1',
    '4:5': '4:5',
    '16:9': '16:9',
  };

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${apiKey}`,
    },
    body: JSON.stringify({
      prompt,
      image_size: aspectRatioMap[options.aspectRatio ?? '9:16'],
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
      enable_safety_checker: true,
      safety_tolerance: '2',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`FAL.ai error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const image = data.images?.[0];
  if (!image?.url) throw new Error('No image returned from FAL.ai');

  return {
    url: image.url,
    width: image.width ?? 512,
    height: image.height ?? 768,
  };
}
