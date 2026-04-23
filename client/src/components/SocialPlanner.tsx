import { useState, useMemo } from 'react';
import {
  Share2, Plus, Calendar as CalendarIcon,
  ChevronLeft, ChevronRight, Clock, Image as ImageIcon,
  Send, Edit2, Trash2, Wand2,
} from 'lucide-react';
import { useTable, useDb } from '../spacetime/hooks';
import PageHeader from './PageHeader';
import ConfirmDialog from './ConfirmDialog';
import { useToast } from '../hooks/useToast';
import AiGenerateModal from './AiGenerateModal';
import ImageGeneratorModal from './ImageGeneratorModal';
import {
  Button, Card, CardBody, Badge, Avatar,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Input, Textarea, Select, SelectItem, DatePicker,
} from '@nextui-org/react';
import { CalendarDate, today, getLocalTimeZone, startOfMonth, endOfMonth } from '@internationalized/date';

const PLATFORM_COLORS: Record<string, string> = {
  TikTok: 'bg-slate-900 text-white',
  Whatsapp: 'bg-emerald-500 text-white',
  Instagram: 'bg-pink-500 text-white',
  Facebook: 'bg-blue-600 text-white',
};

const PLATFORM_ICONS: Record<string, string> = {
  TikTok: 'TT',
  Whatsapp: 'WA',
  Instagram: 'IG',
  Facebook: 'FB',
};

const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-600 border-slate-200',
  Scheduled: 'bg-brand-50 text-brand-700 border-brand-200',
  Published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Failed: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function SocialPlanner() {
  const db = useDb();
  const { success } = useToast();
  const [posts] = useTable('social_posts');
  const [campaigns] = useTable('social_campaigns');

  const [selectedDate, setSelectedDate] = useState<CalendarDate>(today(getLocalTimeZone()));
  const [selectedMonth, setSelectedMonth] = useState<CalendarDate>(today(getLocalTimeZone()));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<bigint | null>(null);
  const [platformFilter, setPlatformFilter] = useState<string>('');
  const [aiModalOpen, setAiModalOpen] = useState(false);

  const activeCampaign = campaigns[0];

  const filteredPosts = useMemo(() => {
    let list = posts as any[];
    if (platformFilter) {
      list = list.filter((p: any) => p.platform?.tag === platformFilter);
    }
    return list;
  }, [posts, platformFilter]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const post of filteredPosts) {
      const d = new Date(post.scheduledAt?.toDate?.() ?? post.scheduledAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(post);
    }
    return map;
  }, [filteredPosts]);

  const selectedDayPosts = useMemo(() => {
    const key = `${selectedDate.year}-${selectedDate.month - 1}-${selectedDate.day}`;
    return postsByDay.get(key) ?? [];
  }, [postsByDay, selectedDate]);

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const startDayOfWeek = monthStart.toDate(getLocalTimeZone()).getDay();
  const daysInMonth = monthEnd.day;

  const prevMonth = () => setSelectedMonth(selectedMonth.subtract({ months: 1 }));
  const nextMonth = () => setSelectedMonth(selectedMonth.add({ months: 1 }));

  const openCreate = () => {
    setEditingPost(null);
    setDrawerOpen(true);
  };

  const openEdit = (post: any) => {
    setEditingPost(post);
    setDrawerOpen(true);
  };

  const promptDelete = (id: bigint) => {
    setDeletingId(id);
    setConfirmOpen(true);
  };

  const doDelete = () => {
    if (!db || !deletingId) return;
    (db.reducers as any).deleteSocialPost({ id: deletingId });
    success('Post deleted');
    setDeletingId(null);
  };

  const handlePublish = (id: bigint) => {
    if (!db) return;
    (db.reducers as any).publishSocialPost({ id });
    success('Post published');
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-fade-in">
      <PageHeader
        title="Social Planner"
        subtitle="Plan, generate, and publish social content"
        actionLabel="New Post"
        onAction={openCreate}
      />

      {/* Campaign bar */}
      <Card className="border border-slate-100 shadow-sm">
        <CardBody className="py-3 px-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-brand-600" />
            <span className="text-sm font-semibold text-slate-800">
              {activeCampaign?.name ?? 'No active campaign'}
            </span>
            {activeCampaign && (
              <Badge variant="flat" size="sm" className="bg-brand-50 text-brand-700 border border-brand-200">
                {activeCampaign.status?.tag}
              </Badge>
            )}
          </div>
          <div className="flex-1" />
          <Select
            className="max-w-[140px]"
            size="sm"
            aria-label="Filter by platform"
            selectedKeys={platformFilter ? [platformFilter] : []}
            onSelectionChange={(keys) => setPlatformFilter(Array.from(keys)[0] as string || '')}
            items={[{key: '', label: 'All Platforms'}, {key: 'TikTok', label: 'TikTok'}, {key: 'Whatsapp', label: 'WhatsApp'}, {key: 'Instagram', label: 'Instagram'}, {key: 'Facebook', label: 'Facebook'}]}
          >
            {(item: any) => <SelectItem key={item.key} textValue={item.label}>{item.label}</SelectItem>}
          </Select>
          <Button size="sm" variant="light" className="text-slate-500" onPress={() => setCampaignModalOpen(true)}>
            <CalendarIcon className="w-4 h-4 mr-1" /> Campaigns
          </Button>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Calendar */}
        <Card className="border border-slate-100 shadow-sm lg:col-span-2">
          <CardBody className="p-5">
            {/* Month header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 font-outfit">
                {selectedMonth.toDate(getLocalTimeZone()).toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })}
              </h3>
              <div className="flex gap-1">
                <Button isIconOnly size="sm" variant="light" onPress={prevMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button isIconOnly size="sm" variant="light" onPress={nextMonth}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {weekDays.map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-slate-400 uppercase tracking-wider py-2">
                  {d}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: startDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="h-24 rounded-lg" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const date = new CalendarDate(selectedMonth.year, selectedMonth.month, day);
                const key = `${date.year}-${date.month - 1}-${day}`;
                const dayPosts = postsByDay.get(key) ?? [];
                const isSelected = selectedDate.day === day && selectedDate.month === date.month && selectedDate.year === date.year;
                const isToday = today(getLocalTimeZone()).compare(date) === 0;

                return (
                  <button
                    key={day}
                    onClick={() => { setSelectedDate(date); setDrawerOpen(true); }}
                    className={`h-24 rounded-lg border p-2 text-left transition-all hover:shadow-sm flex flex-col ${
                      isSelected
                        ? 'border-brand-300 bg-brand-50/50 ring-1 ring-brand-200'
                        : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                  >
                    <span className={`text-sm font-medium ${isToday ? 'text-brand-600' : 'text-slate-700'}`}>
                      {day}
                      {isToday && <span className="ml-1 text-[10px] bg-brand-100 text-brand-700 px-1 rounded">Today</span>}
                    </span>
                    <div className="flex-1 flex flex-wrap content-end gap-1">
                      {dayPosts.slice(0, 4).map((p: any) => (
                        <div
                          key={p.id.toString()}
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                            PLATFORM_COLORS[p.platform?.tag] ?? 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {PLATFORM_ICONS[p.platform?.tag] ?? '?'}
                        </div>
                      ))}
                      {dayPosts.length > 4 && (
                        <span className="text-[10px] text-slate-400 font-medium">+{dayPosts.length - 4}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardBody>
        </Card>

        {/* Day sidebar */}
        <Card className="border border-slate-100 shadow-sm">
          <CardBody className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-slate-800">
                {selectedDate.toDate(getLocalTimeZone()).toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short' })}
              </h4>
              <Button size="sm" color="primary" className="bg-brand-600 h-8 min-w-0 px-2" isIconOnly onPress={openCreate}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-2.5">
              {selectedDayPosts.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  <Share2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p>No posts scheduled</p>
                  <p className="text-xs mt-1">Click + to create one</p>
                </div>
              ) : (
                selectedDayPosts.map((post: any) => (
                  <div
                    key={post.id.toString()}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex items-start gap-2.5">
                      <Avatar
                        size="sm"
                        className={`text-[10px] font-bold shrink-0 ${PLATFORM_COLORS[post.platform?.tag] ?? 'bg-slate-200'}`}
                        name={PLATFORM_ICONS[post.platform?.tag] ?? '?'}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 line-clamp-2">{post.content}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="flat" size="sm" className={STATUS_COLORS[post.status?.tag] ?? ''}>
                            {post.status?.tag}
                          </Badge>
                          <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            {new Date(post.scheduledAt?.toDate?.() ?? post.scheduledAt).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {post.status?.tag === 'Draft' && (
                        <Button isIconOnly size="sm" variant="light" className="text-slate-400 hover:text-emerald-600 h-7 w-7" onPress={() => handlePublish(post.id)}>
                          <Send className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button isIconOnly size="sm" variant="light" className="text-slate-400 hover:text-slate-700 h-7 w-7" onPress={() => openEdit(post)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button isIconOnly size="sm" variant="light" className="text-slate-400 hover:text-rose-600 h-7 w-7" onPress={() => promptDelete(post.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Post Drawer */}
      <SocialPostDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        post={editingPost}
        campaigns={campaigns}
        selectedDate={selectedDate}
      />

      {/* Campaign Modal */}
      <SocialCampaignModal
        isOpen={campaignModalOpen}
        onClose={() => setCampaignModalOpen(false)}
      />

      {/* AI Generate Modal */}
      <AiGenerateModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onAccept={(generatedPosts) => {
          if (!db) return;
          for (const gp of generatedPosts) {
            (db.reducers as any).createSocialPost({
              tenantId: 1n,
              campaignId: activeCampaign?.id,
              platform: { tag: gp.platform },
              content: gp.content,
              imageUrl: undefined,
              hashtags: JSON.stringify(gp.hashtags),
              scheduledAt: gp.scheduled_at,
              targetAudience: gp.target_audience,
              metadata: JSON.stringify({ imagePrompt: gp.image_prompt }),
            });
          }
          success(`${generatedPosts.length} AI posts added to calendar`);
        }}
      />

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={doDelete}
        title="Delete post?"
        description="This will permanently remove the social post."
        confirmLabel="Delete"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ImageUrlField — local modal state wrapper
// ---------------------------------------------------------------------------

function ImageUrlField({ value, onChange, prompt }: { value: string; onChange: (v: string) => void; prompt: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex gap-2">
        <Input
          label="Image URL"
          value={value}
          onValueChange={onChange}
          placeholder="https://..."
          startContent={<ImageIcon className="w-4 h-4 text-slate-400" />}
          className="flex-1"
        />
        <Button
          size="sm"
          color="secondary"
          className="bg-violet-600 text-white mt-6"
          onPress={() => setOpen(true)}
        >
          <Wand2 className="w-4 h-4 mr-1" /> Generate
        </Button>
      </div>
      <ImageGeneratorModal
        isOpen={open}
        onClose={() => setOpen(false)}
        initialPrompt={prompt.slice(0, 200)}
        onSelect={(url) => onChange(url)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// SocialPostDrawer
// ---------------------------------------------------------------------------

function SocialPostDrawer({ isOpen, onClose, post, campaigns, selectedDate }: {
  isOpen: boolean;
  onClose: () => void;
  post: any | null;
  campaigns: readonly any[];
  selectedDate: CalendarDate;
}) {
  const db = useDb();
  const { success } = useToast();
  const [form, setForm] = useState({
    content: '', platform: 'TikTok', campaignId: '',
    hashtags: '', imageUrl: '', scheduledDate: selectedDate,
    scheduledTime: '09:00',
  });

  useMemo(() => {
    if (post) {
      const d = new Date(post.scheduledAt?.toDate?.() ?? post.scheduledAt);
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      setForm({
        content: post.content,
        platform: post.platform?.tag ?? 'TikTok',
        campaignId: post.campaignId?.toString() ?? '',
        hashtags: post.hashtags ?? '',
        imageUrl: post.imageUrl ?? '',
        scheduledDate: selectedDate,
        scheduledTime: `${hours}:${mins}`,
      });
    } else {
      setForm({
        content: '', platform: 'TikTok', campaignId: '',
        hashtags: '', imageUrl: '', scheduledDate: selectedDate,
        scheduledTime: '09:00',
      });
    }
  }, [post, selectedDate]);

  const save = () => {
    if (!db || !form.content) return;
    const [hours, mins] = form.scheduledTime.split(':').map(Number);
    const scheduled = new Date(form.scheduledDate.toDate(getLocalTimeZone()));
    scheduled.setHours(hours, mins, 0, 0);
    const payload = {
      tenantId: 1n,
      campaignId: form.campaignId ? BigInt(form.campaignId) : undefined,
      platform: { tag: form.platform },
      content: form.content,
      imageUrl: form.imageUrl || undefined,
      hashtags: form.hashtags || '[]',
      scheduledAt: scheduled.toISOString(),
      targetAudience: undefined,
      metadata: '{}',
    };
    if (post) {
      (db.reducers as any).updateSocialPost({ id: post.id, ...payload });
      success('Post updated');
    } else {
      (db.reducers as any).createSocialPost(payload);
      success('Post created');
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} size="lg">
      <ModalContent>
        <ModalHeader className="text-slate-900 font-outfit">
          {post ? 'Edit Post' : 'New Social Post'}
        </ModalHeader>
        <ModalBody className="gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Platform"
              selectedKeys={[form.platform]}
              onSelectionChange={(keys) => setForm({ ...form, platform: Array.from(keys)[0] as string })}
              items={[{key: 'TikTok', label: 'TikTok'}, {key: 'Whatsapp', label: 'WhatsApp'}, {key: 'Instagram', label: 'Instagram'}, {key: 'Facebook', label: 'Facebook'}]}
            >
              {(item: any) => <SelectItem key={item.key} textValue={item.label}>{item.label}</SelectItem>}
            </Select>
            <Select
              label="Campaign"
              selectedKeys={form.campaignId ? [form.campaignId] : []}
              onSelectionChange={(keys) => setForm({ ...form, campaignId: Array.from(keys)[0] as string || '' })}
              items={[{key: '', label: 'None'}, ...campaigns.map((c: any) => ({key: c.id.toString(), label: c.name}))]}
            >
              {(item: any) => <SelectItem key={item.key} textValue={item.label}>{item.label}</SelectItem>}
            </Select>
          </div>
          <Textarea
            label="Content"
            value={form.content}
            onValueChange={(v) => setForm({ ...form, content: v })}
            minRows={4}
            placeholder="Write your post content... Use [EN] and [BM] tags for bilingual posts"
          />
          <Input
            label="Hashtags (JSON array)"
            value={form.hashtags}
            onValueChange={(v) => setForm({ ...form, hashtags: v })}
            placeholder='["#SMEMalaysia", #CRM"]'
          />
          <ImageUrlField
            value={form.imageUrl}
            onChange={(v) => setForm({ ...form, imageUrl: v })}
            prompt={form.content}
          />
          <div className="grid grid-cols-2 gap-4">
            <DatePicker
              label="Schedule Date"
              value={form.scheduledDate}
              onChange={(d) => d && setForm({ ...form, scheduledDate: d })}
            />
            <Input
              label="Time"
              type="time"
              value={form.scheduledTime}
              onValueChange={(v) => setForm({ ...form, scheduledTime: v })}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>Cancel</Button>
          <Button color="primary" className="bg-brand-600" onPress={save}>
            {post ? 'Update' : 'Schedule'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// SocialCampaignModal
// ---------------------------------------------------------------------------

function SocialCampaignModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const db = useDb();
  const { success } = useToast();
  const [campaigns] = useTable('social_campaigns');
  const [form, setForm] = useState({ name: '', theme: '', objective: 'Awareness', platforms: 'TikTok,Whatsapp,Instagram' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<bigint | null>(null);

  const save = () => {
    if (!db || !form.name) return;
    (db.reducers as any).createSocialCampaign({
      tenantId: 1n,
      name: form.name,
      theme: form.theme,
      objective: { tag: form.objective },
      platforms: JSON.stringify(form.platforms.split(',').map((p) => p.trim())),
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    });
    success('Campaign created');
    setForm({ name: '', theme: '', objective: 'Awareness', platforms: 'TikTok,Whatsapp,Instagram' });
  };

  const promptDelete = (id: bigint) => {
    setDeletingId(id);
    setConfirmOpen(true);
  };

  const doDelete = () => {
    if (!db || !deletingId) return;
    (db.reducers as any).deleteSocialCampaign({ id: deletingId });
    success('Campaign deleted');
    setDeletingId(null);
  };

  return (
    <>
      <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} size="lg">
        <ModalContent>
          <ModalHeader className="text-slate-900 font-outfit">Campaigns</ModalHeader>
          <ModalBody className="gap-4">
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-700">Create New Campaign</h4>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Name" value={form.name} onValueChange={(v) => setForm({ ...form, name: v })} placeholder="Q2 Growth" />
                <Input label="Theme" value={form.theme} onValueChange={(v) => setForm({ ...form, theme: v })} placeholder="Digital transformation stories" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Objective" selectedKeys={[form.objective]} onSelectionChange={(keys) => setForm({ ...form, objective: Array.from(keys)[0] as string })} items={[{key:'Awareness',label:'Awareness'},{key:'Engagement',label:'Engagement'},{key:'Leads',label:'Leads'},{key:'Sales',label:'Sales'}]}>
                  {(item: any) => <SelectItem key={item.key} textValue={item.label}>{item.label}</SelectItem>}
                </Select>
                <Input label="Platforms" value={form.platforms} onValueChange={(v) => setForm({ ...form, platforms: v })} placeholder="TikTok, WhatsApp, Instagram" />
              </div>
              <Button color="primary" className="bg-brand-600" size="sm" onPress={save}>
                <Plus className="w-4 h-4 mr-1" /> Create Campaign
              </Button>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Existing Campaigns</h4>
              <div className="space-y-2">
                {campaigns.length === 0 && (
                  <p className="text-sm text-slate-400">No campaigns yet</p>
                )}
                {campaigns.map((c: any) => (
                  <div key={c.id.toString()} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.theme}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="flat" size="sm" className={STATUS_COLORS[c.status?.tag] ?? ''}>
                        {c.status?.tag}
                      </Badge>
                      <Button isIconOnly size="sm" variant="light" className="text-slate-400 hover:text-rose-600 h-7 w-7" onPress={() => promptDelete(c.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={doDelete}
        title="Delete campaign?"
        description="This will permanently remove the campaign and unlink related posts."
        confirmLabel="Delete"
      />
    </>
  );
}
