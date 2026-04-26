import { useState } from 'react';
import { Plus, Wand2, Sparkles, Save, Play, Pause, Trash2, Mail, Bot } from 'lucide-react';
import VoiceInput from './VoiceInput';
import { useTable, useDb } from '../spacetime/hooks';
import PageHeader from './PageHeader';
import ConfirmDialog from './ConfirmDialog';
import WorkflowCanvas from './WorkflowCanvas';
import { generateWorkflow, type GeneratedWorkflow } from '../services/mercury';
import {
  Button, Card, CardBody, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Badge, Textarea, Tabs, Tab
} from '@nextui-org/react';

export default function AutomationBuilder() {
  const db = useDb();
  const [workflows] = useTable('workflows');
  const [modalOpen, setModalOpen] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<bigint | null>(null);
  const [description, setDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedWorkflow | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  const startCreate = () => {
    setDescription('');
    setGenerated(null);
    setModalOpen(true);
  };

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setGenerating(true);
    try {
      const wf = await generateWorkflow(description.trim());
      setGenerated(wf);
      setEmailSubject(wf.email_template?.subject || '');
      setEmailBody(wf.email_template?.body || '');
    } catch (err: any) {
      alert('Failed to generate workflow: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const saveWorkflow = () => {
    if (!db || !generated) return;
    const steps = generated.steps.map(s => ({
      ...s,
      config: s.type === 'send_email' && emailSubject && emailBody
        ? { ...s.config, subject: emailSubject, body: emailBody }
        : s.config,
    }));
    (db.reducers as any).createWorkflow({
      tenantId: 1n,
      name: generated.name,
      description: generated.description,
      triggerType: generated.trigger_type,
      triggerConfig: JSON.stringify(generated.trigger_config),
      steps: JSON.stringify(steps),
    });
    setModalOpen(false);
    setGenerated(null);
  };

  const toggleStatus = (id: bigint, current: string) => {
    if (!db) return;
    const next = current === 'active' ? 'paused' : 'active';
    (db.reducers as any).toggleWorkflowStatus({ id, status: next });
  };

  const promptDelete = (id: bigint) => {
    setDeletingId(id);
    setConfirmOpen(true);
  };

  const doDelete = () => {
    if (!db || !deletingId) return;
    (db.reducers as any).deleteWorkflow({ id: deletingId });
    setDeletingId(null);
  };

  const parseSteps = (stepsJson: string): any[] => {
    try { return JSON.parse(stepsJson); } catch { return []; }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-fade-in">
      <PageHeader title="Automations" subtitle="Build workflows with natural language powered by Mercury 2" actionLabel="Create Automation" actionIcon={Plus} onAction={startCreate} />

      {/* Workflow list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {workflows.map((wf: any) => {
          const steps = parseSteps(wf.steps);
          const isActive = wf.status === 'active';
          return (
            <Card key={wf.id.toString()} className="border border-slate-100 shadow-sm hover:shadow-md transition-all">
              <CardBody className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-brand-50">
                      <Bot className="w-4 h-4 text-brand-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-slate-800">{wf.name}</h3>
                      <p className="text-xs text-slate-400">{wf.description}</p>
                    </div>
                  </div>
                  <Badge color={isActive ? 'success' : 'default'} variant="flat" size="sm" className="font-medium">
                    {wf.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                  <Badge variant="faded" size="sm" className="text-[10px]">{wf.triggerType}</Badge>
                  <span>{steps.length} steps</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    className={isActive ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}
                    startContent={isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    onPress={() => toggleStatus(wf.id, wf.status)}
                  >
                    {isActive ? 'Pause' : 'Activate'}
                  </Button>
                  <Button isIconOnly size="sm" variant="light" className="text-slate-400 hover:text-rose-600" onPress={() => promptDelete(wf.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardBody>
            </Card>
          );
        })}

        {workflows.length === 0 && (
          <Card className="border border-dashed border-slate-200 bg-slate-50/50 col-span-full">
            <CardBody className="py-12 text-center">
              <Sparkles className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <h3 className="font-semibold text-slate-700">No automations yet</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
                Describe what you want to automate in plain English and our AI will build a visual workflow for you.
              </p>
              <Button color="primary" className="bg-brand-600 mt-4 mx-auto" startContent={<Wand2 className="w-4 h-4" />} onPress={startCreate}>
                Create your first automation
              </Button>
            </CardBody>
          </Card>
        )}
      </div>

      {/* Create modal */}
      <Modal isOpen={modalOpen} onOpenChange={setModalOpen} size="2xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="text-slate-900 font-outfit">
            <div className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-brand-600" />
              Describe your automation
            </div>
          </ModalHeader>
          <ModalBody className="gap-5">
            {!generated ? (
              <>
                <p className="text-sm text-slate-500">
                  Tell us what you want to automate in plain English. Our AI (powered by{' '}
                  <span className="font-semibold text-brand-600">Mercury 2</span>) will design a workflow for you.
                </p>
                <div className="relative">
                  <Textarea
                    placeholder="Example: Send a follow up email to each website order, welcoming the customer to our brand... (or click the mic to speak)"
                    value={description}
                    onValueChange={setDescription}
                    minRows={4}
                    classNames={{ input: 'text-sm placeholder:text-slate-400 pr-10' }}
                  />
                  <div className="absolute top-2 right-2">
                    <VoiceInput
                      onTranscript={setDescription}
                      append
                      currentText={description}
                    />
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[
                    'Send a welcome email to new website contacts',
                    'Remind me to follow up on deals in Proposal after 2 days',
                    'Send invoice payment reminders every Monday',
                  ].map((example) => (
                    <button
                      key={example}
                      onClick={() => setDescription(example)}
                      className="text-xs px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600 hover:bg-brand-50 hover:border-brand-200 hover:text-brand-700 transition-colors"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800">{generated.name}</h3>
                    <p className="text-sm text-slate-500">{generated.description}</p>
                  </div>
                  <Badge color="primary" variant="flat" className="bg-brand-50 text-brand-700">{generated.trigger_type}</Badge>
                </div>

                <Tabs aria-label="Workflow details">
                  <Tab key="flow" title="Workflow">
                    <WorkflowCanvas steps={generated.steps} />
                  </Tab>
                  <Tab key="email" title="Email Template">
                    {generated.email_template ? (
                      <div className="space-y-4 py-3">
                        <Input
                          label="Subject"
                          value={emailSubject}
                          onValueChange={setEmailSubject}
                          startContent={<Mail className="w-4 h-4 text-slate-400" />}
                        />
                        <Textarea
                          label="Body"
                          value={emailBody}
                          onValueChange={setEmailBody}
                          minRows={8}
                          classNames={{ input: 'font-mono text-sm' }}
                        />
                        <p className="text-xs text-slate-400">
                          Use variables like {'{{contact.name}}'}, {'{{contact.email}}'}, {'{{company.name}}'}
                        </p>
                      </div>
                    ) : (
                      <div className="py-8 text-center text-slate-400 text-sm">No email template in this workflow</div>
                    )}
                  </Tab>
                </Tabs>
              </>
            )}
          </ModalBody>
          <ModalFooter>
            {!generated ? (
              <>
                <Button variant="light" onPress={() => setModalOpen(false)}>Cancel</Button>
                <Button
                  color="primary"
                  className="bg-brand-600"
                  startContent={<Sparkles className="w-4 h-4" />}
                  isLoading={generating}
                  onPress={handleGenerate}
                >
                  Generate Workflow
                </Button>
              </>
            ) : (
              <>
                <Button variant="light" onPress={() => setGenerated(null)}>Back</Button>
                <Button color="primary" className="bg-brand-600" startContent={<Save className="w-4 h-4" />} onPress={saveWorkflow}>
                  Save Automation
                </Button>
              </>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={doDelete}
        title="Delete automation?"
        description="This will permanently remove the workflow."
        confirmLabel="Delete"
      />
    </div>
  );
}
