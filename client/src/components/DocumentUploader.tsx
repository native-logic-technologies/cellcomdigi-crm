import { useState, useCallback } from 'react';
import { Upload, FileText, X, Sparkles } from 'lucide-react';
import { Button, Progress } from '@nextui-org/react';
import { useDb } from '../spacetime/hooks';
import {
  extractTextFromFile,
  generateSummary,
  extractKeywords,
  buildDocumentMetadata,
} from '../services/documentIngestion';
import { saveInsightsFromDocument } from '../services/autoInsight';

interface DocumentUploaderProps {
  tenantId: bigint;
  targetEntityTable?: string;
  targetEntityId?: bigint;
  onUploaded?: () => void;
}

export default function DocumentUploader({ tenantId, targetEntityTable, targetEntityId, onUploaded }: DocumentUploaderProps) {
  const db = useDb();
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'extracting' | 'uploading' | 'done'>('idle');
  const [error, setError] = useState('');

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) {
      setFile(f);
      setError('');
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setError('');
    }
  }, []);

  const handleUpload = async () => {
    if (!file || !db) return;
    setStatus('extracting');
    setProgress(20);

    try {
      const extracted = await extractTextFromFile(file);
      setProgress(50);

      const summary = await generateSummary(extracted.contentText);
      const keywords = extractKeywords(extracted.contentText);
      const metadata = buildDocumentMetadata(file);

      setStatus('uploading');
      setProgress(80);

      (db.reducers as any).createDocument({
        tenantId,
        title: extracted.title,
        sourceUrl: undefined,
        contentText: extracted.contentText.slice(0, 50000), // cap at ~50k chars
        fileType: extracted.fileType,
        extractedSummary: summary,
        extractedKeywords: JSON.stringify(keywords),
        metadata: JSON.stringify(metadata),
        uploadedBy: 1n,
        targetEntityTable: targetEntityTable ?? undefined,
        targetEntityId: targetEntityId ?? undefined,
      });

      setProgress(100);
      setStatus('done');
      setFile(null);

      // Auto-extract insights from uploaded document
      try {
        const insightCount = await saveInsightsFromDocument(
          extracted.contentText,
          extracted.title,
          tenantId,
          targetEntityTable,
          targetEntityId,
          db
        );
        if (insightCount > 0) {
          setError(''); // clear any previous error
          // We reuse the success state; the insight count is silent
        }
      } catch (insightErr) {
        console.error('Auto-insight extraction failed:', insightErr);
      }

      onUploaded?.();
    } catch (e: any) {
      setError(e.message || 'Upload failed');
      setStatus('idle');
      setProgress(0);
    }
  };

  return (
    <div className="space-y-3">
      {!file ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-brand-300 transition-colors cursor-pointer"
          onClick={() => document.getElementById('doc-upload')?.click()}
        >
          <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Drop a file or click to upload</p>
          <p className="text-xs text-slate-400 mt-1">PDF, DOCX, TXT supported</p>
          <input id="doc-upload" type="file" className="hidden" onChange={handleFileSelect} accept=".pdf,.docx,.doc,.txt,.md,.csv,.json" />
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-brand-600" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
              <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button onClick={() => { setFile(null); setStatus('idle'); setProgress(0); }} className="p-1 rounded hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {status !== 'idle' && status !== 'done' && (
            <Progress size="sm" value={progress} color="primary" className="h-1" />
          )}

          {status === 'done' && (
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Uploaded successfully
            </p>
          )}

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <Button
            size="sm"
            color="primary"
            onPress={handleUpload}
            isDisabled={status === 'extracting' || status === 'uploading'}
            className="w-full"
          >
            {status === 'extracting' ? 'Extracting text...' : status === 'uploading' ? 'Saving to graph...' : 'Upload to Memory'};
          </Button>
        </div>
      )}
    </div>
  );
}
