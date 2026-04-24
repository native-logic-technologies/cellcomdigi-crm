import { useState, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import { useDb, useTable } from '../spacetime/hooks';
import { useToast } from '../hooks/useToast';
import {
  Modal, ModalContent, ModalHeader, ModalBody,
  Button, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Select, SelectItem, Progress, Badge, Card, CardBody,
} from '@nextui-org/react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CsvRow {
  [key: string]: string;
}

interface ColumnMapping {
  csvColumn: string;
  field: string;
}

const CONTACT_FIELDS = [
  { key: '_ignore', label: '— Ignore —' },
  { key: 'name', label: 'Name *' },
  { key: 'email', label: 'Email *' },
  { key: 'phone', label: 'Phone' },
  { key: 'company_name', label: 'Company Name' },
  { key: 'source', label: 'Source' },
  { key: 'status', label: 'Status' },
  { key: 'assigned_to_name', label: 'Assigned To (name)' },
];

const FIELD_ALIASES: Record<string, string[]> = {
  name: ['name', 'full name', 'contact name', 'first name', 'customer name', 'client name', 'person name', 'contact'],
  email: ['email', 'e-mail', 'email address', 'mail', 'emailaddress', 'email_addr'],
  phone: ['phone', 'mobile', 'tel', 'telephone', 'contact number', 'phone number', 'whatsapp', 'hp', 'handphone', 'cell', 'cellphone', 'contact_no'],
  company_name: ['company', 'company name', 'organization', 'business', 'company_name', 'org', 'business name', 'firm', 'organisation'],
  source: ['source', 'lead source', 'channel', 'origin', 'referral source', 'leadsource', 'how did you hear'],
  status: ['status', 'lead status', 'contact status', 'type', 'leadstatus', 'contact_status'],
  assigned_to_name: ['assigned', 'assigned to', 'owner', 'sales rep', 'agent', 'user', 'assigned_to', 'salesrep', 'representative', 'pic'],
};

function scoreColumnMatch(csvHeader: string, field: string): number {
  const header = csvHeader.toLowerCase().trim().replace(/[_-]/g, ' ');
  const aliases = FIELD_ALIASES[field];
  if (!aliases) return 0;
  let best = 0;
  for (const alias of aliases) {
    if (header === alias) return 100;
    if (header.includes(alias)) best = Math.max(best, 70);
    if (alias.includes(header)) best = Math.max(best, 50);
    // Word-level match
    const headerWords = header.split(/\s+/);
    const aliasWords = alias.split(/\s+/);
    const common = headerWords.filter(w => aliasWords.includes(w)).length;
    if (common > 0) best = Math.max(best, common * 25);
  }
  return best;
}

function autoMapColumns(headers: string[]): ColumnMapping[] {
  const assignedFields = new Set<string>();
  const mappings: ColumnMapping[] = [];

  for (const csvColumn of headers) {
    let bestField = '_ignore';
    let bestScore = 0;
    for (const field of Object.keys(FIELD_ALIASES)) {
      if (assignedFields.has(field)) continue;
      const score = scoreColumnMatch(csvColumn, field);
      if (score > bestScore) {
        bestScore = score;
        bestField = field;
      }
    }
    if (bestScore >= 40) {
      assignedFields.add(bestField);
      mappings.push({ csvColumn, field: bestField });
    } else {
      mappings.push({ csvColumn, field: '_ignore' });
    }
  }
  return mappings;
}

function buildContactRow(row: CsvRow, mappings: ColumnMapping[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const m of mappings) {
    if (m.field !== '_ignore' && row[m.csvColumn] !== undefined) {
      result[m.field] = row[m.csvColumn].trim();
    }
  }
  return result;
}

export default function CsvImportModal({ isOpen, onClose }: CsvImportModalProps) {
  const db = useDb();
  const { success, error: toastError } = useToast();
  const [contacts] = useTable('contacts');

  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'importing'>('upload');
  const [rawData, setRawData] = useState<CsvRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const existingEmails = useMemo(() => {
    const set = new Set<string>();
    for (const c of contacts) {
      if (c.email) set.add(c.email.toLowerCase().trim());
    }
    return set;
  }, [contacts]);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.tsv')) {
      toastError('Invalid file', 'Please upload a CSV or TSV file.');
      return;
    }
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as CsvRow[];
        if (data.length === 0) {
          toastError('Empty file', 'No rows found in the CSV.');
          return;
        }
        const cols = Object.keys(data[0]);
        setHeaders(cols);
        setRawData(data);
        const autoMappings = autoMapColumns(cols);
        setMappings(autoMappings);
        setStep('map');
      },
      error: (err) => {
        toastError('Parse error', err.message);
      },
    });
  }, [toastError]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const mappedContacts = useMemo(() => {
    return rawData.map(row => buildContactRow(row, mappings));
  }, [rawData, mappings]);

  const validation = useMemo(() => {
    const errors: { row: number; issues: string[] }[] = [];
    const dupEmails = new Set<string>();
    let validCount = 0;

    for (let i = 0; i < mappedContacts.length; i++) {
      const row = mappedContacts[i];
      const issues: string[] = [];
      if (!row.name) issues.push('Missing name');
      if (!row.email) issues.push('Missing email');
      else {
        const email = row.email.toLowerCase().trim();
        if (existingEmails.has(email)) issues.push('Email already exists');
        if (dupEmails.has(email)) issues.push('Duplicate email in file');
        else dupEmails.add(email);
      }
      if (issues.length === 0) validCount++;
      if (issues.length > 0) errors.push({ row: i + 1, issues });
    }
    return { errors, validCount };
  }, [mappedContacts, existingEmails]);

  const handleImport = async () => {
    if (!db) return;
    setImporting(true);
    setStep('importing');

    const validRows = mappedContacts.filter((row, i) => {
      const hasName = !!row.name;
      const hasEmail = !!row.email;
      const email = row.email?.toLowerCase().trim() ?? '';
      const notDupInFile = mappedContacts.findIndex(
        (r, idx) => idx < i && r.email?.toLowerCase().trim() === email
      ) === -1;
      const notExisting = !existingEmails.has(email);
      return hasName && hasEmail && notDupInFile && notExisting;
    });

    // Send in batches of 50 to stay within reasonable payload size
    const BATCH_SIZE = 50;
    let totalImported = 0;

    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);
      const json = JSON.stringify(batch);
      try {
        (db.reducers as any).bulkImportContacts({ tenantId: 1n, contactsJson: json });
        totalImported += batch.length;
        setImportProgress(Math.round(((i + batch.length) / validRows.length) * 100));
      } catch (err: any) {
        toastError('Import error', err?.message ?? 'Failed to import batch');
        break;
      }
    }

    setImportResult({
      imported: totalImported,
      skipped: mappedContacts.length - totalImported,
    });
    setImporting(false);
    success('Import complete', `${totalImported} contacts imported, ${mappedContacts.length - totalImported} skipped.`);
  };

  const reset = () => {
    setStep('upload');
    setRawData([]);
    setHeaders([]);
    setMappings([]);
    setImportProgress(0);
    setImportResult(null);
    setImporting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="4xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-primary" />
          Import Contacts from CSV
        </ModalHeader>
        <ModalBody>
          {step === 'upload' && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
                dragOver ? 'border-primary bg-primary/5' : 'border-default-200 hover:border-primary/50'
              }`}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.csv,.tsv';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleFile(file);
                };
                input.click();
              }}
            >
              <Upload className={`w-12 h-12 mx-auto mb-4 ${dragOver ? 'text-primary' : 'text-default-400'}`} />
              <p className="text-lg font-medium">Drop your CSV file here</p>
              <p className="text-sm text-default-500 mt-1">or click to browse</p>
              <p className="text-xs text-default-400 mt-4">
                Supports: name, email, phone, company name, source, status, assigned to
              </p>
            </div>
          )}

          {step === 'map' && (
            <div className="space-y-4">
              <p className="text-sm text-default-600">
                We detected <strong>{rawData.length}</strong> rows. Please confirm the column mappings:
              </p>
              <Table aria-label="Column mapping" removeWrapper>
                <TableHeader>
                  <TableColumn>CSV Column</TableColumn>
                  <TableColumn>Map To</TableColumn>
                  <TableColumn>Sample Value</TableColumn>
                </TableHeader>
                <TableBody>
                  {headers.map((header) => {
                    const mapping = mappings.find(m => m.csvColumn === header);
                    const sample = rawData[0]?.[header] ?? '';
                    return (
                      <TableRow key={header}>
                        <TableCell className="font-medium">{header}</TableCell>
                        <TableCell>
                          <Select
                            size="sm"
                            selectedKeys={mapping ? [mapping.field] : ['_ignore']}
                            onChange={(e) => {
                              const val = e.target.value;
                              setMappings(prev => prev.map(m =>
                                m.csvColumn === header ? { ...m, field: val } : m
                              ));
                            }}
                          >
                            {CONTACT_FIELDS.map(f => (
                              <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                            ))}
                          </Select>
                        </TableCell>
                        <TableCell className="text-default-500 text-sm truncate max-w-[200px]">
                          {sample}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex justify-between">
                <Button variant="flat" onClick={reset}>Back</Button>
                <Button
                  color="primary"
                  endContent={<ChevronRight className="w-4 h-4" />}
                  onClick={() => setStep('preview')}
                >
                  Preview
                </Button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge color="success" variant="flat">{validation.validCount} valid</Badge>
                {validation.errors.length > 0 && (
                  <Badge color="danger" variant="flat">{validation.errors.length} issues</Badge>
                )}
                <span className="text-sm text-default-500">of {mappedContacts.length} rows</span>
              </div>

              {validation.errors.length > 0 && (
                <Card className="bg-danger-50">
                  <CardBody className="py-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-danger mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-danger">Validation issues found</p>
                        <div className="max-h-32 overflow-y-auto mt-1 space-y-1">
                          {validation.errors.slice(0, 10).map((err, i) => (
                            <p key={i} className="text-danger-600">
                              Row {err.row}: {err.issues.join(', ')}
                            </p>
                          ))}
                          {validation.errors.length > 10 && (
                            <p className="text-danger-400">...and {validation.errors.length - 10} more</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              )}

              <Table aria-label="Preview" removeWrapper className="max-h-[300px]">
                <TableHeader>
                  <TableColumn>#</TableColumn>
                  <TableColumn>Name</TableColumn>
                  <TableColumn>Email</TableColumn>
                  <TableColumn>Phone</TableColumn>
                  <TableColumn>Company</TableColumn>
                  <TableColumn>Status</TableColumn>
                </TableHeader>
                <TableBody>
                  {mappedContacts.slice(0, 10).map((row, i) => {
                    const hasError = validation.errors.some(e => e.row === i + 1);
                    return (
                      <TableRow key={i} className={hasError ? 'bg-danger-50/50' : ''}>
                        <TableCell className="text-default-400 text-xs">{i + 1}</TableCell>
                        <TableCell>{row.name || <span className="text-danger text-xs">—</span>}</TableCell>
                        <TableCell>{row.email || <span className="text-danger text-xs">—</span>}</TableCell>
                        <TableCell>{row.phone || <span className="text-default-300">—</span>}</TableCell>
                        <TableCell>{row.company_name || <span className="text-default-300">—</span>}</TableCell>
                        <TableCell>
                          <Badge size="sm" variant="flat" color={row.status?.toLowerCase() === 'customer' ? 'success' : 'warning'}>
                            {row.status || 'Lead'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {mappedContacts.length > 10 && (
                <p className="text-xs text-default-400 text-center">
                  Showing first 10 of {mappedContacts.length} rows
                </p>
              )}

              <div className="flex justify-between">
                <Button variant="flat" startContent={<ChevronLeft className="w-4 h-4" />} onClick={() => setStep('map')}>
                  Back
                </Button>
                <Button
                  color="primary"
                  onClick={handleImport}
                  isDisabled={validation.validCount === 0}
                  isLoading={importing}
                >
                  Import {validation.validCount} Contacts
                </Button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="py-12 text-center space-y-6">
              {importing ? (
                <>
                  <Progress value={importProgress} className="max-w-md mx-auto" color="primary" showValueLabel />
                  <p className="text-default-600">Importing contacts into SpacetimeDB...</p>
                  <p className="text-xs text-default-400">This may take a few seconds for large files</p>
                </>
              ) : importResult ? (
                <div className="space-y-4">
                  <CheckCircle2 className="w-16 h-16 text-success mx-auto" />
                  <div>
                    <p className="text-xl font-semibold">Import Complete!</p>
                    <p className="text-default-500 mt-1">
                      <strong>{importResult.imported}</strong> contacts imported successfully
                    </p>
                    {importResult.skipped > 0 && (
                      <p className="text-sm text-default-400 mt-1">
                        {importResult.skipped} rows skipped due to errors or duplicates
                      </p>
                    )}
                  </div>
                  <Button color="primary" onClick={handleClose}>
                    Done
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
