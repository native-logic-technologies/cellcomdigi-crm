import { useState } from 'react';
import { Send, Archive, MessageCircle } from 'lucide-react';
import { safeDate, formatRelative, formatTime } from '../lib/dateUtils';
import { useTable, useDb } from '../spacetime/hooks';
import PageHeader from './PageHeader';
import {
  Card, CardBody, Badge, Button, Input, Avatar,
  ScrollShadow
} from '@nextui-org/react';

export default function Inbox() {
  const db = useDb();
  const [conversations] = useTable('conversations');
  const [messages] = useTable('messages');
  const [contacts] = useTable('contacts');
  const [selectedConv, setSelectedConv] = useState<bigint | null>(null);
  const [reply, setReply] = useState('');

  const contactMap = new Map(contacts.map((c: any) => [c.id, c]));

  const sortedConversations = [...conversations].sort((a: any, b: any) => {
    const da = safeDate(a.lastMessageAt);
    const db = safeDate(b.lastMessageAt);
    return (db?.getTime() ?? 0) - (da?.getTime() ?? 0);
  });

  const selectedConversation = sortedConversations.find((c: any) => c.id === selectedConv);
  const convMessages = selectedConversation
    ? messages
        .filter((m: any) => m.conversationId === selectedConversation.id)
        .sort((a: any, b: any) => {
          const da = safeDate(a.createdAt);
          const db = safeDate(b.createdAt);
          return (da?.getTime() ?? 0) - (db?.getTime() ?? 0);
        })
    : [];

  const sendReply = () => {
    if (!db || !selectedConversation || !reply.trim()) return;
    (db.reducers as any).sendMessage({
      tenantId: selectedConversation.tenantId,
      conversationId: selectedConversation.id,
      senderType: { tag: 'User' }, senderId: 1n,
      body: reply.trim(), attachments: '[]',
      direction: { tag: 'Outbound' },
    });
    setReply('');
  };

  const archive = (id: bigint) => {
    if (!db) return;
    (db.reducers as any).archiveConversation({ id });
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-fade-in">
      <PageHeader title="Inbox" subtitle="Unified conversations across channels" />

      <Card className="flex overflow-hidden border border-slate-100 shadow-sm" style={{ height: 'calc(100vh - 220px)' }}>
        {/* Sidebar */}
        <div className="w-80 border-r border-slate-100 flex flex-col bg-white">
          <div className="p-4 border-b border-slate-50">
            <h3 className="font-semibold text-sm text-slate-800">Conversations</h3>
          </div>
          <ScrollShadow className="flex-1">
            {sortedConversations.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-sm">No conversations</div>
            )}
            {sortedConversations.map((conv: any) => {
              const contact = contactMap.get(conv.contactId);
              const active = selectedConv === conv.id;
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
          </ScrollShadow>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-slate-50/50">
          {!selectedConversation ? (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-lg font-medium text-slate-600">Select a conversation</p>
                <p className="text-sm text-slate-400">Choose from the sidebar to start messaging</p>
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
                <Button isIconOnly variant="light" size="sm" className="text-slate-400" onPress={() => archive(selectedConversation.id)}>
                  <Archive className="w-4 h-4" />
                </Button>
              </div>
              <ScrollShadow className="flex-1 p-4 space-y-3">
                {convMessages.map((msg: any) => {
                  const isOutbound = msg.direction?.tag === 'Outbound';
                  const senderName = isOutbound ? 'You' : (contactMap.get(selectedConversation.contactId)?.name ?? 'Contact');
                  return (
                    <div key={msg.id.toString()} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] ${isOutbound ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                        <span className={`text-[10px] px-1 ${isOutbound ? 'text-slate-400' : 'text-slate-500'}`}>{senderName}</span>
                        <Card className={`shadow-sm ${isOutbound ? 'bg-brand-600 text-white' : 'bg-white border border-slate-100'}`}>
                          <CardBody className="py-2 px-3">
                            <p className="text-sm">{msg.body}</p>
                          </CardBody>
                        </Card>
                        <span className={`text-[10px] px-1 ${isOutbound ? 'text-slate-400' : 'text-slate-400'}`}>
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </ScrollShadow>
              <div className="p-3 border-t border-slate-100 bg-white flex gap-2">
                <Input
                  classNames={{ inputWrapper: 'bg-slate-50 border-slate-200' }}
                  className="flex-1"
                  placeholder="Type a reply..."
                  value={reply}
                  onValueChange={setReply}
                  onKeyDown={(e) => e.key === 'Enter' && sendReply()}
                />
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
