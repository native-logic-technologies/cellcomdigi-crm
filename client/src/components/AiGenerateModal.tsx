import { useState } from 'react';
import { Wand2, Sparkles, Check, Calendar, Brain } from 'lucide-react';
import { useTable } from '../spacetime/hooks';
import { useSupermemory } from '../services/supermemory';
import { generateSocialBatch, type GeneratedSocialPost } from '../services/socialAi';
import {
  Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Textarea, Select, SelectItem, Badge, Card, CardBody,
} from '@nextui-org/react';

interface AiGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: (posts: GeneratedSocialPost[]) => void;
}

export default function AiGenerateModal({ isOpen, onClose, onAccept }: AiGenerateModalProps) {
  const [companies] = useTable('companies');
  const [products] = useTable('products');
  const [deals] = useTable('deals');
  const [contacts] = useTable('contacts');
  const { buildCompanyContext } = useSupermemory(1n); // demo tenant

  const [theme, setTheme] = useState('');
  const [objective, setObjective] = useState('Awareness');
  const [platforms, setPlatforms] = useState<string[]>(['TikTok', 'Instagram']);
  const [days, setDays] = useState(7);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedSocialPost[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [lastGraphContext, setLastGraphContext] = useState('');

  const handleGenerate = async () => {
    if (!theme.trim()) return;
    setGenerating(true);
    setGenerated([]);
    setSelectedIndices(new Set());
    try {
      // Build memory context from first company (or generic)
      let graphContext = '';
      if (companies.length > 0) {
        try {
          const ctx = buildCompanyContext(companies[0].id, { includeMemories: true, includeDocuments: true });
          graphContext = ctx.formatted;
        } catch { /* ignore */ }
      }
      setLastGraphContext(graphContext);

      const result = await generateSocialBatch(
        theme,
        objective,
        platforms,
        days,
        {
          companies: companies.slice(0, 5),
          products: products.slice(0, 5),
          wonDeals: deals.filter((d: any) => d.status?.tag === 'Won').slice(0, 3),
          contacts: contacts.slice(0, 5),
          graphContext,
        }
      );
      setGenerated(result.posts);
      setSelectedIndices(new Set(result.posts.map((_, i) => i)));
    } catch (err: any) {
      alert('Generation failed: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const toggleSelect = (i: number) => {
    const next = new Set(selectedIndices);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelectedIndices(next);
  };

  const handleAccept = () => {
    const accepted = generated.filter((_, i) => selectedIndices.has(i));
    onAccept(accepted);
    setGenerated([]);
    setSelectedIndices(new Set());
    onClose();
  };

  const platformOptions = [
    { key: 'TikTok', label: 'TikTok' },
    { key: 'Whatsapp', label: 'WhatsApp' },
    { key: 'Instagram', label: 'Instagram' },
    { key: 'Facebook', label: 'Facebook' },
  ];

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} size="3xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="text-slate-900 font-outfit flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-brand-600" />
          AI Content Generator
        </ModalHeader>
        <ModalBody className="gap-4">
          {/* Input panel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Textarea
                label="Campaign Theme"
                placeholder="e.g., SME digital transformation stories, Raya promotion, product launch..."
                value={theme}
                onValueChange={setTheme}
                minRows={2}
              />
            </div>
            <div className="space-y-3">
              <Select label="Objective" selectedKeys={[objective]} onSelectionChange={(keys) => setObjective(Array.from(keys)[0] as string)} items={[{key:'Awareness',label:'Awareness'},{key:'Engagement',label:'Engagement'},{key:'Leads',label:'Leads'},{key:'Sales',label:'Sales'}]}>
                {(item: any) => <SelectItem key={item.key} textValue={item.label}>{item.label}</SelectItem>}
              </Select>
              <Select label="Duration" selectedKeys={[days.toString()]} onSelectionChange={(keys) => setDays(Number(Array.from(keys)[0]))} items={[{key:'7',label:'1 week (7 posts)'},{key:'14',label:'2 weeks (14 posts)'},{key:'30',label:'1 month (30 posts)'}]}>
                {(item: any) => <SelectItem key={item.key} textValue={item.label}>{item.label}</SelectItem>}
              </Select>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">Platforms</p>
            <div className="flex gap-2">
              {platformOptions.map((p) => {
                const active = platforms.includes(p.key);
                return (
                  <button
                    key={p.key}
                    onClick={() => {
                      if (active) setPlatforms(platforms.filter((x) => x !== p.key));
                      else setPlatforms([...platforms, p.key]);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      active
                        ? 'bg-brand-50 text-brand-700 border-brand-200'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              color="primary"
              className="bg-brand-600 flex-1"
              onPress={handleGenerate}
              isLoading={generating}
              startContent={!generating && <Sparkles className="w-4 h-4" />}
              isDisabled={!theme.trim() || platforms.length === 0}
            >
              {generating ? 'Generating...' : 'Generate Posts'}
            </Button>
            {lastGraphContext && (
              <Badge variant="flat" size="sm" className="bg-brand-50 text-brand-700 border border-brand-200">
                <Brain className="w-3 h-3 mr-1" /> Memory
              </Badge>
            )}
          </div>

          {/* Results */}
          {generated.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">
                  Generated {generated.length} posts · {selectedIndices.size} selected
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="light" onPress={() => setSelectedIndices(new Set(generated.map((_, i) => i)))}>
                    Select All
                  </Button>
                  <Button size="sm" variant="light" onPress={() => setSelectedIndices(new Set())}>
                    Deselect All
                  </Button>
                </div>
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {generated.map((post, i) => (
                  <Card
                    key={i}
                    className={`border cursor-pointer transition-all ${
                      selectedIndices.has(i)
                        ? 'border-brand-300 bg-brand-50/30 shadow-sm'
                        : 'border-slate-100 bg-white opacity-60 hover:opacity-100'
                    }`}
                    onPress={() => toggleSelect(i)}
                    isPressable
                  >
                    <CardBody className="p-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          selectedIndices.has(i) ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-400'
                        }`}>
                          {selectedIndices.has(i) ? <Check className="w-3 h-3" /> : <span className="text-[10px]">{i + 1}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="flat" size="sm" className="bg-slate-50 text-slate-600 border border-slate-200 text-[10px]">
                              {post.platform}
                            </Badge>
                            <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                              <Calendar className="w-3 h-3" />
                              {new Date(post.scheduled_at).toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                          <p className="text-sm text-slate-800 line-clamp-3">{post.content}</p>
                          {post.hashtags.length > 0 && (
                            <p className="text-xs text-brand-600 mt-1">{post.hashtags.join(' ')}</p>
                          )}
                          {post.image_prompt && (
                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">🎨 {post.image_prompt}</p>
                          )}
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>Cancel</Button>
          {generated.length > 0 && (
            <Button color="primary" className="bg-brand-600" onPress={handleAccept} isDisabled={selectedIndices.size === 0}>
              Add {selectedIndices.size} Posts to Calendar
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
