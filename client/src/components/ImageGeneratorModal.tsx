import { useState } from 'react';
import { Wand2, Image as ImageIcon, Check, Download } from 'lucide-react';
import { generateImage, type FalImageResult } from '../services/falAi';
import {
  Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Textarea, Card, CardBody,
} from '@nextui-org/react';

interface ImageGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
  onSelect: (url: string) => void;
}

const STYLES = [
  { key: 'photorealistic', label: 'Photorealistic' },
  { key: 'illustration', label: 'Illustration' },
  { key: '3d', label: '3D Render' },
  { key: 'minimal', label: 'Minimal' },
];

const RATIOS = [
  { key: '9:16', label: 'TikTok (9:16)', w: 300, h: 533 },
  { key: '1:1', label: 'WhatsApp (1:1)', w: 300, h: 300 },
  { key: '4:5', label: 'Instagram (4:5)', w: 300, h: 375 },
  { key: '16:9', label: 'Facebook (16:9)', w: 300, h: 169 },
];

export default function ImageGeneratorModal({ isOpen, onClose, initialPrompt, onSelect }: ImageGeneratorModalProps) {
  const [prompt, setPrompt] = useState(initialPrompt ?? '');
  const [style, setStyle] = useState('photorealistic');
  const [ratio, setRatio] = useState('9:16');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<FalImageResult | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError('');
    setResult(null);
    try {
      const img = await generateImage(prompt, { aspectRatio: ratio as any, style: style as any });
      setResult(img);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSelect = () => {
    if (result) {
      onSelect(result.url);
      setResult(null);
      onClose();
    }
  };

  const ratioDims = RATIOS.find((r) => r.key === ratio) ?? RATIOS[0];

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} size="lg">
      <ModalContent>
        <ModalHeader className="text-slate-900 font-outfit flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-brand-600" />
          Generate Image (Flux 2)
        </ModalHeader>
        <ModalBody className="gap-4">
          <Textarea
            label="Image Prompt"
            value={prompt}
            onValueChange={setPrompt}
            minRows={3}
            placeholder="A vibrant Malaysian street food scene at night, warm lighting, bustling atmosphere, photorealistic..."
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1.5">Style</p>
              <div className="flex flex-wrap gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setStyle(s.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      style === s.key
                        ? 'bg-brand-50 text-brand-700 border-brand-200'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1.5">Aspect Ratio</p>
              <div className="flex flex-wrap gap-2">
                {RATIOS.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setRatio(r.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      ratio === r.key
                        ? 'bg-brand-50 text-brand-700 border-brand-200'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button
            color="primary"
            className="bg-brand-600"
            onPress={handleGenerate}
            isLoading={generating}
            startContent={!generating && <Wand2 className="w-4 h-4" />}
            isDisabled={!prompt.trim()}
          >
            {generating ? 'Generating...' : 'Generate Image'}
          </Button>

          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 p-2 rounded-lg">{error}</p>
          )}

          {result && (
            <Card className="border border-slate-100 shadow-sm">
              <CardBody className="p-3">
                <div className="flex flex-col items-center gap-3">
                  <img
                    src={result.url}
                    alt="Generated"
                    className="rounded-lg object-cover border border-slate-100"
                    style={{ width: ratioDims.w, height: ratioDims.h }}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="light" onPress={() => window.open(result.url, '_blank')}>
                      <Download className="w-4 h-4 mr-1" /> View Full
                    </Button>
                    <Button size="sm" color="primary" className="bg-brand-600" onPress={handleSelect}>
                      <Check className="w-4 h-4 mr-1" /> Use This Image
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
