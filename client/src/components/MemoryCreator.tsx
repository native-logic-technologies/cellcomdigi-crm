import { useState } from 'react';
import { Lightbulb, Save, X } from 'lucide-react';
import { Button, Textarea, Input, Select, SelectItem } from '@nextui-org/react';
import { useDb } from '../spacetime/hooks';

interface MemoryCreatorProps {
  tenantId: bigint;
  targetEntityTable?: string;
  targetEntityId?: bigint;
  onCreated?: () => void;
  onCancel?: () => void;
}

const MEMORY_TYPES = [
  { key: 'Note', label: 'Note' },
  { key: 'Insight', label: 'Insight' },
  { key: 'Fact', label: 'Fact' },
  { key: 'Template', label: 'Template' },
];

export default function MemoryCreator({ tenantId, targetEntityTable, targetEntityId, onCreated, onCancel }: MemoryCreatorProps) {
  const db = useDb();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [memoryType, setMemoryType] = useState('Note');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !content.trim() || !db) return;
    setSaving(true);
    try {
      (db.reducers as any).createMemory({
        tenantId,
        title: title.trim(),
        content: content.trim(),
        memoryType: { tag: memoryType },
        sourceTable: targetEntityTable ?? undefined,
        sourceId: targetEntityId ?? undefined,
        createdBy: 1n, // demo mode
      });
      setTitle('');
      setContent('');
      onCreated?.();
    } catch (e) {
      console.error('Failed to create memory', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <Lightbulb className="w-4 h-4 text-amber-500" />
        Add Memory / Insight
      </div>
      <Input
        size="sm"
        placeholder="Title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Textarea
        size="sm"
        placeholder="What do you want to remember about this?"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        minRows={3}
      />
      <div className="flex items-center gap-2">
        <Select
          size="sm"
          selectedKeys={[memoryType]}
          onSelectionChange={(keys) => {
            const val = Array.from(keys)[0] as string;
            if (val) setMemoryType(val);
          }}
          className="w-32"
        >
          {MEMORY_TYPES.map((t) => (
            <SelectItem key={t.key}>{t.label}</SelectItem>
          ))}
        </Select>
        <Button
          size="sm"
          color="primary"
          onPress={handleSave}
          isLoading={saving}
          isDisabled={!title.trim() || !content.trim()}
          startContent={<Save className="w-4 h-4" />}
        >
          Save
        </Button>
        {onCancel && (
          <Button size="sm" variant="light" onPress={onCancel} startContent={<X className="w-4 h-4" />}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
