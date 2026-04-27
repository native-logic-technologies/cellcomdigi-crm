import { useState, useEffect } from 'react';
import { Search, Pencil, Trash2, Eye, Upload, X, Users, Tag } from 'lucide-react';
import { useTable, useDb } from '../spacetime/hooks';
import { useToast } from '../hooks/useToast';
import { useLanguage } from '../i18n/LanguageContext';
import { useNavigation } from '../context/NavigationContext';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import PageHeader from './PageHeader';
import ConfirmDialog from './ConfirmDialog';
import ContactDrawer from './ContactDrawer';
import CsvImportModal from './CsvImportModal';
import {
  Button, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Badge, Card, CardBody, Avatar, Select, SelectItem, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem
} from '@nextui-org/react';

const statusOptions = ['Lead', 'Prospect', 'Customer', 'Churned'];
const sourceOptions = ['Whatsapp', 'Tiktok', 'Email', 'Website', 'Manual', 'Pos'];
const statusColorMap: Record<string, 'warning' | 'primary' | 'success' | 'default'> = {
  Lead: 'warning', Prospect: 'primary', Customer: 'success', Churned: 'default',
};

export default function Contacts() {
  const { t } = useLanguage();
  const db = useDb();
  const { success } = useToast();
  const { pendingAction, clearAction } = useNavigation();
  const [contacts] = useTable('contacts');
  const [companies] = useTable('companies');
  const [users] = useTable('users');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<bigint | null>(null);
  const [drawerContact, setDrawerContact] = useState<any | null>(null);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', companyId: '', status: 'Lead', source: 'Manual',
  });

  useEffect(() => {
    if (pendingAction === 'createContact') {
      openCreate();
      clearAction();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const companyMap = new Map(companies.map((c: any) => [c.id, c]));

  const filtered = contacts.filter((c: any) => {
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q);
    const matchesStatus = !statusFilter || c.status?.tag === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const { displayCount, sentinelRef } = useInfiniteScroll(filtered.length);
  const visibleContacts = filtered.slice(0, displayCount);

  const selectedCount = selectedKeys.size;
  const selectedIds = Array.from(selectedKeys).map(id => BigInt(id));

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', email: '', phone: '', companyId: '', status: 'Lead', source: 'Manual' });
    setModalOpen(true);
  };

  const openEdit = (contact: any) => {
    setEditing(contact);
    setForm({
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      companyId: contact.companyId?.toString() ?? '',
      status: (contact.status as any)?.tag ?? 'Lead',
      source: (contact.source as any)?.tag ?? 'Manual',
    });
    setModalOpen(true);
  };

  const save = () => {
    if (!db || !form.name || !form.email) return;
    const companyId = form.companyId ? BigInt(form.companyId) : undefined;
    if (editing) {
      (db.reducers as any).updateContact({
        id: editing.id, email: form.email, phone: form.phone, name: form.name,
        companyId, status: { tag: form.status }, assignedTo: editing.assignedTo,
        customFields: editing.customFields,
      });
      success('Contact updated', `${form.name} has been updated.`);
    } else {
      (db.reducers as any).createContact({
        tenantId: 1n, email: form.email, phone: form.phone, name: form.name,
        companyId, source: { tag: form.source }, status: { tag: form.status },
        assignedTo: undefined, customFields: '{}',
      });
      success('Contact created', `${form.name} has been added.`);
    }
    setModalOpen(false);
  };

  const promptRemove = (id: bigint) => {
    setDeletingId(id);
    setConfirmOpen(true);
  };

  const remove = () => {
    if (!db || !deletingId) return;
    (db.reducers as any).deleteContact({ id: deletingId });
    success('Contact deleted', 'The contact has been removed.');
    setDeletingId(null);
  };

  // Bulk actions
  const handleBulkDelete = () => {
    if (!db || selectedIds.length === 0) return;
    (db.reducers as any).bulkDeleteContacts({ idsJson: JSON.stringify(selectedIds.map(id => Number(id))) });
    success('Contacts deleted', `${selectedIds.length} contacts removed.`);
    setSelectedKeys(new Set());
    setBulkConfirmOpen(false);
  };

  const handleBulkStatusChange = (statusTag: string) => {
    if (!db || selectedIds.length === 0) return;
    (db.reducers as any).bulkUpdateContactStatus({
      idsJson: JSON.stringify(selectedIds.map(id => Number(id))),
      status: { tag: statusTag },
    });
    success('Status updated', `${selectedIds.length} contacts set to ${statusTag}.`);
    setSelectedKeys(new Set());
  };

  const handleBulkAssign = (userId: string) => {
    if (!db || selectedIds.length === 0) return;
    const uid = userId === 'none' ? undefined : BigInt(userId);
    (db.reducers as any).bulkUpdateContactAssignedTo({
      idsJson: JSON.stringify(selectedIds.map(id => Number(id))),
      assignedTo: uid !== undefined ? { tag: 'some', value: uid } : undefined,
    });
    success('Assignee updated', `${selectedIds.length} contacts reassigned.`);
    setSelectedKeys(new Set());
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-fade-in">
      <PageHeader
        title={t('contacts.title')}
        subtitle={t('contacts.subtitle')}
        actionLabel={t('contacts.addContact')}
        onAction={openCreate}
        secondaryAction={
          <Button
            variant="flat"
            startContent={<Upload className="w-4 h-4" />}
            onPress={() => setCsvImportOpen(true)}
          >
            {t('common.importCsv')}
          </Button>
        }
      />

      <Card className="border border-slate-100 shadow-sm">
        <CardBody className="flex flex-row flex-wrap gap-3 py-4">
          <Input
            classNames={{ base: 'max-w-md', inputWrapper: 'bg-slate-50 border-slate-200', input: 'text-sm placeholder:text-slate-400' }}
            placeholder={t('contacts.searchPlaceholder')}
            startContent={<Search className="w-4 h-4 text-slate-400" />}
            value={search}
            onValueChange={setSearch}
          />
          <Select
            className="max-w-xs"
            placeholder={t('common.filterByStatus')}
            aria-label="Filter contacts by status"
            selectedKeys={statusFilter ? [statusFilter] : []}
            onSelectionChange={(keys) => {
              const val = Array.from(keys)[0] as string;
              setStatusFilter(val === 'all' ? '' : val);
            }}
            items={[{key: 'all', label: t('common.allStatuses')}, ...statusOptions.map(s => ({key: s, label: s}))]}
          >
            {(item: any) => <SelectItem key={item.key} textValue={item.label}>{item.label}</SelectItem>}
          </Select>
        </CardBody>
      </Card>

      <Card className="border border-slate-100 shadow-sm">
        {/* Bulk action bar */}
        {selectedCount > 0 && (
          <div className="flex items-center justify-between px-4 py-3 bg-brand-50 border-b border-brand-100">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-brand-700">
                {selectedCount} {t('contacts.selected')}
              </span>
              <Button size="sm" variant="light" className="text-brand-600 h-7" onPress={() => setSelectedKeys(new Set())}>
                <X className="w-3.5 h-3.5 mr-1" /> {t('common.clear')}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Dropdown>
                <DropdownTrigger>
                  <Button size="sm" variant="flat" startContent={<Tag className="w-3.5 h-3.5" />} className="h-8">
                    {t('common.changeStatus')}
                  </Button>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label="Change status"
                  items={statusOptions.map(s => ({key: s, label: s}))}
                  onAction={(key) => handleBulkStatusChange(key as string)}
                >
                  {(item: any) => <DropdownItem key={item.key}>{item.label}</DropdownItem>}
                </DropdownMenu>
              </Dropdown>

              <Dropdown>
                <DropdownTrigger>
                  <Button size="sm" variant="flat" startContent={<Users className="w-3.5 h-3.5" />} className="h-8">
                    {t('common.assignTo')}
                  </Button>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label="Assign to"
                  items={[{key: 'none', label: t('common.unassigned')}, ...users.map((u: any) => ({key: u.id.toString(), label: u.name}))]}
                  onAction={(key) => handleBulkAssign(key as string)}
                >
                  {(item: any) => <DropdownItem key={item.key}>{item.label}</DropdownItem>}
                </DropdownMenu>
              </Dropdown>

              <Button size="sm" color="danger" variant="flat" startContent={<Trash2 className="w-3.5 h-3.5" />} className="h-8" onPress={() => setBulkConfirmOpen(true)}>
                {t('common.delete')}
              </Button>
            </div>
          </div>
        )}

        <CardBody className="p-0">
          <Table
            removeWrapper
            aria-label="Contacts table"
            selectionMode="multiple"
            selectedKeys={selectedKeys}
            onSelectionChange={(keys) => {
              if (keys === 'all') {
                setSelectedKeys(new Set(filtered.map((c: any) => c.id.toString())));
              } else {
                setSelectedKeys(new Set(Array.from(keys as Set<string>)));
              }
            }}
            classNames={{ th: 'bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider', td: 'py-3' }}
          >
            <TableHeader>
              <TableColumn>{t('contacts.name')}</TableColumn>
              <TableColumn>{t('contacts.email')}</TableColumn>
              <TableColumn>{t('contacts.phone')}</TableColumn>
              <TableColumn>{t('contacts.company')}</TableColumn>
              <TableColumn>{t('contacts.status')}</TableColumn>
              <TableColumn>{t('contacts.source')}</TableColumn>
              <TableColumn className="text-right">{t('contacts.actions')}</TableColumn>
            </TableHeader>
            <TableBody emptyContent={t('contacts.noContacts')}>
              {visibleContacts.map((c: any) => (
                <TableRow key={c.id.toString()} className="hover:bg-slate-50/60 transition-colors">
                  <TableCell>
                    <button
                      className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
                      onClick={() => setDrawerContact(c)}
                    >
                      <Avatar name={c.name} size="sm" className="bg-brand-100 text-brand-700" />
                      <span className="font-medium text-slate-800">{c.name}</span>
                    </button>
                  </TableCell>
                  <TableCell className="text-slate-600">{c.email}</TableCell>
                  <TableCell className="text-slate-600">{c.phone}</TableCell>
                  <TableCell className="text-slate-600">{c.companyId ? companyMap.get(c.companyId)?.name ?? '—' : '—'}</TableCell>
                  <TableCell>
                    <Badge color={statusColorMap[c.status?.tag] ?? 'default'} variant="flat" size="sm" className="font-medium">
                      {c.status?.tag}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="faded" size="sm" className="text-slate-500 font-medium">{c.source?.tag}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button isIconOnly size="sm" variant="light" className="text-slate-400 hover:text-slate-700" onPress={() => setDrawerContact(c)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button isIconOnly size="sm" variant="light" className="text-slate-400 hover:text-slate-700" onPress={() => openEdit(c)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button isIconOnly size="sm" variant="light" className="text-slate-400 hover:text-rose-600" onPress={() => promptRemove(c.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {displayCount < filtered.length && (
            <div ref={sentinelRef} className="py-4 text-center text-xs text-slate-400">
              Loading more… ({displayCount} of {filtered.length})
            </div>
          )}
        </CardBody>
      </Card>

      <Modal isOpen={modalOpen} onOpenChange={setModalOpen} size="lg">
        <ModalContent>
          <ModalHeader className="text-slate-900 font-outfit">{editing ? t('contacts.editContact') : t('contacts.newContact')}</ModalHeader>
          <ModalBody className="gap-4">
            <Input label={t('contacts.name')} value={form.name} onValueChange={(v) => setForm({ ...form, name: v })} isRequired />
            <div className="grid grid-cols-2 gap-4">
              <Input label={t('contacts.email')} type="email" value={form.email} onValueChange={(v) => setForm({ ...form, email: v })} isRequired />
              <Input label={t('contacts.phone')} value={form.phone} onValueChange={(v) => setForm({ ...form, phone: v })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select label={t('contacts.status')} selectedKeys={[form.status]} onSelectionChange={(keys) => setForm({ ...form, status: Array.from(keys)[0] as string })} items={statusOptions.map(s => ({key: s, label: s}))}>
                {(item: any) => <SelectItem key={item.key} textValue={item.label}>{item.label}</SelectItem>}
              </Select>
              <Select label={t('contacts.source')} selectedKeys={[form.source]} onSelectionChange={(keys) => setForm({ ...form, source: Array.from(keys)[0] as string })} items={sourceOptions.map(s => ({key: s, label: s}))}>
                {(item: any) => <SelectItem key={item.key} textValue={item.label}>{item.label}</SelectItem>}
              </Select>
            </div>
            <Select label={t('contacts.company')} selectedKeys={form.companyId ? [form.companyId] : []} onSelectionChange={(keys) => setForm({ ...form, companyId: Array.from(keys)[0] as string || '' })} items={[{key: 'none', label: t('common.clear')}, ...companies.map((c: any) => ({key: c.id.toString(), label: c.name}))]}>
              {(item: any) => <SelectItem key={item.key} textValue={item.label}>{item.label}</SelectItem>}
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button color="primary" className="bg-brand-600" onPress={save}>{t('common.save')}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={remove}
        title={`${t('common.delete')} ${t('contacts.title').toLowerCase()}?`}
        description="This will permanently remove the contact from your CRM."
        confirmLabel={t('common.delete')}
      />

      <ConfirmDialog
        isOpen={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        onConfirm={handleBulkDelete}
        title={`${t('common.delete')} ${selectedCount} ${t('contacts.title').toLowerCase()}?`}
        description="This will permanently remove all selected contacts from your CRM. This action cannot be undone."
        confirmLabel={t('common.deleteAll')}
      />

      {drawerContact && <ContactDrawer contact={drawerContact} onClose={() => setDrawerContact(null)} />}

      <CsvImportModal isOpen={csvImportOpen} onClose={() => setCsvImportOpen(false)} />
    </div>
  );
}
