import { useState, useEffect, useCallback } from 'react';
import { Send, Archive, MessageCircle, Sparkles, Database, Wand2 } from 'lucide-react';
import { safeDate, formatRelative, formatTime } from '../lib/dateUtils';
import { useTable, useDb } from '../spacetime/hooks';
import { useVertices, useEdges } from '../spacetime/useKg';
import { generateAiReply, buildKgContext } from '../services/kgAiReply';
import { getArchivedMessages, archiveHealth } from '../services/archiveApi';
import PageHeader from './PageHeader';
import { useLanguage } from '../i18n/LanguageContext';
import {
  Card, CardBody, Badge, Button, Input, Avatar,
} from '@nextui-org/react';

interface ArchiveMsg {
  id: number;
  tenant_id: number;
  conversation_id: number;
  sender: string;
  sender_id?: number;
  body: string;
  created_at: number;
}

export default function Inbox() {
  const { t } = useLanguage();
  const db = useDb();
  const [conversations] = useTable('conversations');
  const [messages] = useTable('messages');
  const [contacts] = useTable('contacts');
  const [selectedConv, setSelectedConv] = useState<bigint | null>(null);
  const [reply, setReply] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [archivedMsgs, setArchivedMsgs] = useState<ArchiveMsg[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiveAvailable, setArchiveAvailable] = useState<boolean | null>(null);
  // Check if archive service is available
  useEffect(() => {
    archiveHealth()
      .then(() => setArchiveAvailable(true))
      .catch(() => setArchiveAvailable(false));
  }, []);

  const contactMap = new Map(contacts.map((c: any) => [c.id, c]));

  const sortedConversations = [...conversations].sort((a: any, b: any) => {
    const da = safeDate(a.lastMessageAt);
    const db_ = safeDate(b.lastMessageAt);
    return (db_?.getTime() ?? 0) - (da?.getTime() ?? 0);
  });

  const selectedConversation = sortedConversations.find((c: any) => c.id == selectedConv);

  // Load archived messages when conversation changes
  useEffect(() => {
    if (!selectedConversation || archiveAvailable !== true) {
      setArchivedMsgs([]);
      return;
    }
    const convId = Number(selectedConversation.id);
    setArchiveLoading(true);
    setArchiveError(null);
    getArchivedMessages(convId, { limit: 500 })
      .then((res) => {
        setArchivedMsgs(res.messages);
        setArchiveLoading(false);
      })
      .catch((err) => {
        setArchiveError(err.message);
        setArchiveLoading(false);
      });
  }, [selectedConversation?.id, archiveAvailable]);

  // Merge SpacetimeDB messages (recent) + archived messages (older)
  const recentMessages = selectedConversation
    ? messages
        .filter((m: any) => m.conversationId == selectedConversation.id)
        .map((m: any) => ({
          id: Number(m.id),
          tenant_id: Number(m.tenantId),
          conversation_id: Number(m.conversationId),
          sender: m.senderType?.tag === 'User' ? 'user' : 'contact',
          sender_id: Number(m.senderId),
          body: m.body,
          created_at: safeDate(m.createdAt)?.getTime() ?? 0,
          _source: 'spacetime' as const,
        }))
    : [];

  const archivedMessagesMapped = archivedMsgs.map((m) => ({
    ...m,
    _source: 'archive' as const,
  }));

  // Merge and dedupe by id, preferring SpacetimeDB (more recent)
  const allMessagesMap = new Map<number, any>();
  for (const m of archivedMessagesMapped) allMessagesMap.set(m.id, m);
  for (const m of recentMessages) allMessagesMap.set(m.id, m); // overwrite with live data

  const convMessages = Array.from(allMessagesMap.values()).sort(
    (a, b) => a.created_at - b.created_at
  );

  const sendReply = useCallback(async () => {
    if (!db || !selectedConversation || !reply.trim()) return;
    // Always write to SpacetimeDB for real-time sync
    (db.reducers as any).sendMessage({
      tenantId: selectedConversation.tenantId,
      conversationId: selectedConversation.id,
      senderType: { tag: 'User' }, senderId: 1n,
      body: reply.trim(),
      attachments: '[]',
      direction: { tag: 'Outbound' },
    });

    setReply('');
  }, [db, selectedConversation, reply, archiveAvailable]);

  const archive = (id: bigint) => {
    if (!db) return;
    (db.reducers as any).archiveConversation({ id });
  };

  const seedDemoInbox = () => {
    if (!db) {
      console.warn('[Inbox] Cannot seed — db connection not available');
      alert('Database connection not ready. Please wait a moment and try again.');
      return;
    }
    const lang = localStorage.getItem('cellcom_language') || 'en';
    console.log('[Inbox] Seeding demo inbox data...');
    try {
      // If no contacts exist, seed full demo data first (contacts + companies + deals + inbox)
      if (contacts.length === 0) {
        console.log('[Inbox] No contacts found — calling seedDemoData first...');
        (db.reducers as any).seedDemoData({ language: lang });
      } else {
        console.log('[Inbox] Contacts exist (' + contacts.length + ') — calling seedInboxData...');
        (db.reducers as any).seedInboxData({ tenantId: 1n, language: lang });
      }
      console.log('[Inbox] Seed reducer called successfully');
    } catch (err: any) {
      console.error('[Inbox] Seed failed:', err);
      alert('Failed to seed inbox: ' + (err.message || 'Unknown error'));
    }
  };

  const { vertices } = useVertices();
  const { edges } = useEdges();

  const handleGenerateReply = async () => {
    if (!selectedConversation || convMessages.length === 0) return;
    const contact = contactMap.get(selectedConversation.contactId);
    if (!contact) return;

    setIsGenerating(true);
    try {
      const kgCtx = buildKgContext(contact.id, vertices as any, edges as any);
      const recentMessages = convMessages.slice(-6).map((msg: any) => ({
        sender: msg.sender === 'user' || msg.direction?.tag === 'Outbound' ? 'You' : (contact.name || 'Customer'),
        body: msg.body,
        direction: msg.sender === 'user' || msg.direction?.tag === 'Outbound' ? 'Outbound' : 'Inbound',
      }));

      const generated = await generateAiReply({
        contactName: contact.name || 'Customer',
        contactEmail: contact.email || '',
        contactStatus: contact.status?.tag,
        recentMessages,
        kgContext: kgCtx,
      });

      setReply(generated);
    } catch (err: any) {
      console.error('AI reply generation failed:', err);
      setReply('Sorry, I could not generate a reply right now. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-fade-in">
      <PageHeader
        title={t('inbox.title')}
        subtitle={t('inbox.subtitle')}
        secondaryAction={
          <Button
            size="sm"
            variant="flat"
            className="text-brand-600 font-medium"
            startContent={<Wand2 className="w-3.5 h-3.5" />}
            onPress={seedDemoInbox}
          >
            {t('inbox.seedDemo')}
          </Button>
        }
      />

      <Card className="flex flex-row overflow-hidden border border-slate-100 shadow-sm" style={{ height: 'calc(100vh - 220px)' }}>
        {/* Sidebar */}
        <div className="w-80 border-r border-slate-100 flex flex-col bg-white">
          <div className="p-4 border-b border-slate-50 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-slate-800">{t('inbox.conversations')}</h3>
            {archiveAvailable === true && (
              <span title="Archive service online"><Database className="w-3.5 h-3.5 text-emerald-500" /></span>
            )}
          </div>
          <div className="flex-1 overflow-auto">
            {sortedConversations.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-sm">{t('inbox.noConversations')}</div>
            )}
            {sortedConversations.map((conv: any) => {
              const contact = contactMap.get(conv.contactId);
              const active = selectedConv == conv.id;
              return (
                <button
                  key={conv.id.toString()}
                  onClick={() => setSelectedConv(conv.id)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${active ? 'bg-brand-50' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={contact?.name ?? '?'} size="sm" className="bg-brand-100 text-brand-700" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-slate-800 truncate">{contact?.name ?? 'Unknown'}</span>
                        {conv.unreadCount > 0 && (
                          <span className="bg-rose-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="flat" size="sm" className="text-[10px] h-4 bg-slate-100 text-slate-600">{conv.channel?.tag}</Badge>
                        <span className="text-xs text-slate-400">{formatRelative(conv.lastMessageAt)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-slate-50/50">
          {!selectedConversation ? (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-lg font-medium text-slate-600">{t('common.selectConversation')}</p>
                <p className="text-sm text-slate-400">{t('common.chooseFromSidebar')}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <Avatar name={contactMap.get(selectedConversation.contactId)?.name ?? '?'} size="sm" className="bg-brand-100 text-brand-700" />
                  <div>
                    <h3 className="font-semibold text-sm text-slate-800">{contactMap.get(selectedConversation.contactId)?.name ?? 'Unknown'}</h3>
                    <p className="text-xs text-slate-400">{selectedConversation.channel?.tag} &middot; {selectedConversation.channelConversationId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {archiveAvailable === true && archivedMsgs.length > 0 && (
                    <Badge variant="flat" size="sm" className="text-[10px] bg-emerald-50 text-emerald-600">
                      <Database className="w-3 h-3 mr-1" />
                      {archivedMsgs.length} archived
                    </Badge>
                  )}
                  <Button isIconOnly variant="light" size="sm" className="text-slate-400" onPress={() => archive(selectedConversation.id)}>
                    <Archive className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-auto">
                <div className="p-4 space-y-3">
                  {archiveLoading && (
                    <div className="text-center text-xs text-slate-400 py-2">{t('common.loadingArchived')}</div>
                  )}
                  {archiveError && (
                    <div className="text-center text-xs text-rose-500 py-2">{t('common.archiveError')}: {archiveError}</div>
                  )}
                  {convMessages.map((msg: any) => {
                    const isOutbound = msg.direction?.tag === 'Outbound' || msg.sender === 'user';
                    const senderName = isOutbound ? 'You' : (contactMap.get(selectedConversation.contactId)?.name ?? 'Contact');
                    const isArchived = msg._source === 'archive';
                    return (
                      <div key={msg.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] ${isOutbound ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                          <span className={`text-[10px] px-1 ${isOutbound ? 'text-slate-400' : 'text-slate-500'}`}>
                            {senderName}
                            {isArchived && <span className="ml-1 text-emerald-500" title="Archived on SSD">•</span>}
                          </span>
                          <Card className={`shadow-sm ${isOutbound ? 'bg-brand-600 text-white' : 'bg-white border border-slate-100'}`}>
                            <CardBody className="py-2 px-3">
                              <p className="text-sm">{msg.body}</p>
                            </CardBody>
                          </Card>
                          <span className={`text-[10px] px-1 ${isOutbound ? 'text-slate-400' : 'text-slate-400'}`}>
                            {formatTime(new Date(msg.created_at))}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="p-3 border-t border-slate-100 bg-white flex gap-2">
                <Input
                  classNames={{ inputWrapper: 'bg-slate-50 border-slate-200' }}
                  className="flex-1"
                  placeholder={t('inbox.typeReply')}
                  value={reply}
                  onValueChange={setReply}
                  onKeyDown={(e) => e.key === 'Enter' && sendReply()}
                />
                <Button
                  color="secondary"
                  variant="flat"
                  className="bg-violet-50 text-violet-600 border border-violet-200"
                  isIconOnly
                  isLoading={isGenerating}
                  onPress={handleGenerateReply}
                  title={t('inbox.aiReply')}
                >
                  <Sparkles className="w-4 h-4" />
                </Button>
                <Button color="primary" className="bg-brand-600" isIconOnly onPress={sendReply}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
