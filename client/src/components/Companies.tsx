import { useState } from 'react';
import { Search, Pencil, Trash2, Eye, Phone, Mail, Globe, StickyNote, X } from 'lucide-react';
import { useTable, useDb } from '../spacetime/hooks';
import { useToast } from '../hooks/useToast';
import PageHeader from './PageHeader';
import ConfirmDialog from './ConfirmDialog';
import CompanyDrawer from './CompanyDrawer';
import {
  Button, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Card, CardBody, Avatar, Textarea
} from '@nextui-org/react';

export default function Companies() {
  const db = useDb();
  const { success } = useToast();
  const [companies] = useTable('companies');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<bigint | null>(null);
  const [drawerCompany, setDrawerCompany] = useState<any | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', registrationNumber: '', industry: '',
    phone: '', email: '', website: '',
    address: '', billingAddress: '', notes: ''
  });

  const filtered = companies.filter((c: any) => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q)
      || (c.registrationNumber ?? '').toLowerCase().includes(q)
      || (c.email ?? '').toLowerCase().includes(q)
      || (c.phone ?? '').toLowerCase().includes(q);
  });

  const selectedCount = selectedKeys.size;
  const selectedIds = Array.from(selectedKeys).map(id => BigInt(id));

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', registrationNumber: '', industry: '', phone: '', email: '', website: '', address: '', billingAddress: '', notes: '' });
    setModalOpen(true);
  };

  const openEdit = (company: any) => {
    setEditing(company);
    setForm({
      name: company.name,
      registrationNumber: company.registrationNumber ?? '',
      industry: company.industry ?? '',
      phone: company.phone ?? '',
      email: company.email ?? '',
      website: company.website ?? '',
      address: company.address ?? '{}',
      billingAddress: company.billingAddress ?? '{}',
      notes: company.notes ?? '',
    });
    setModalOpen(true);
  };

  const save = () => {
    if (!db || !form.name) return;
    const payload = {
      name: form.name,
      registrationNumber: form.registrationNumber || undefined,
      industry: form.industry || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      website: form.website || undefined,
      address: form.address || '{}',
      billingAddress: form.billingAddress || '{}',
      notes: form.notes || '',
    };
    if (editing) {
      (db.reducers as any).updateCompany({ id: editing.id, ...payload });
      success('Company updated', `${payload.name} has been updated.`);
    } else {
      (db.reducers as any).createCompany({ tenantId: 1n, ...payload });
      success('Company created', `${payload.name} has been added.`);
    }
    setModalOpen(false);
  };

  const promptRemove = (id: bigint) => {
    setDeletingId(id);
    setConfirmOpen(true);
  };

  const remove = () => {
    if (!db || !deletingId) return;
    (db.reducers as any).deleteCompany({ id: deletingId });
    success('Company deleted', 'The company has been removed.');
    setDeletingId(null);
  };

  const handleBulkDelete = () => {
    if (!db || selectedIds.length === 0) return;
    (db.reducers as any).bulkDeleteCompanies({ idsJson: JSON.stringify(selectedIds) });
    success('Companies deleted', `${selectedIds.length} companies removed.`);
    setSelectedKeys(new Set());
    setBulkConfirmOpen(false);
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-fade-in">
      <PageHeader title="Companies" subtitle="Manage your business accounts" actionLabel="Add Company" onAction={openCreate} />

      <Card className="border border-slate-100 shadow-sm">
        <CardBody className="py-4">
          <Input
            classNames={{ base: 'max-w-md', inputWrapper: 'bg-slate-50 border-slate-200', input: 'text-sm placeholder:text-slate-400' }}
            placeholder="Search companies..."
            startContent={<Search className="w-4 h-4 text-slate-400" />}
            value={search}
            onValueChange={setSearch}
          />
        </CardBody>
      </Card>

      <Card className="border border-slate-100 shadow-sm">
        {selectedCount > 0 && (
          <div className="flex items-center justify-between px-4 py-3 bg-brand-50 border-b border-brand-100">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-brand-700">
                {selectedCount} selected
              </span>
              <Button size="sm" variant="light" className="text-brand-600 h-7" onPress={() => setSelectedKeys(new Set())}>
                <X className="w-3.5 h-3.5 mr-1" /> Clear
              </Button>
            </div>
            <Button size="sm" color="danger" variant="flat" startContent={<Trash2 className="w-3.5 h-3.5" />} className="h-8" onPress={() => setBulkConfirmOpen(true)}>
              Delete
            </Button>
          </div>
        )}

        <CardBody className="p-0">
          <Table
            removeWrapper
            aria-label="Companies table"
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
              <TableColumn>NAME</TableColumn>
              <TableColumn>REG. NUMBER</TableColumn>
              <TableColumn>INDUSTRY</TableColumn>
              <TableColumn>CONTACT</TableColumn>
              <TableColumn className="text-right">ACTIONS</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No companies found">
              {filtered.map((c: any) => (
                <TableRow key={c.id.toString()} className="hover:bg-slate-50/60 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} size="sm" className="bg-emerald-100 text-emerald-700" />
                      <div>
                        <span className="font-medium text-slate-800">{c.name}</span>
                        {c.website && <p className="text-[11px] text-slate-400">{c.website}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600">{c.registrationNumber ?? '—'}</TableCell>
                  <TableCell className="text-slate-600">{c.industry ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5 text-xs text-slate-500">
                      {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</span>}
                      {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button isIconOnly size="sm" variant="light" className="text-slate-400 hover:text-slate-700" onPress={() => setDrawerCompany(c)}>
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
        </CardBody>
      </Card>

      <Modal isOpen={modalOpen} onOpenChange={setModalOpen} size="lg">
        <ModalContent>
          <ModalHeader className="text-slate-900 font-outfit">{editing ? 'Edit Company' : 'New Company'}</ModalHeader>
          <ModalBody className="gap-4">
            <Input label="Name" value={form.name} onValueChange={(v) => setForm({ ...form, name: v })} isRequired />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Registration Number" value={form.registrationNumber} onValueChange={(v) => setForm({ ...form, registrationNumber: v })} />
              <Input label="Industry" value={form.industry} onValueChange={(v) => setForm({ ...form, industry: v })} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Phone" value={form.phone} onValueChange={(v) => setForm({ ...form, phone: v })} startContent={<Phone className="w-3.5 h-3.5 text-slate-400" />} />
              <Input label="Email" type="email" value={form.email} onValueChange={(v) => setForm({ ...form, email: v })} startContent={<Mail className="w-3.5 h-3.5 text-slate-400" />} />
              <Input label="Website" value={form.website} onValueChange={(v) => setForm({ ...form, website: v })} startContent={<Globe className="w-3.5 h-3.5 text-slate-400" />} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Textarea label="Address (JSON)" value={form.address} onValueChange={(v) => setForm({ ...form, address: v })} />
              <Textarea label="Billing Address (JSON)" value={form.billingAddress} onValueChange={(v) => setForm({ ...form, billingAddress: v })} />
            </div>
            <Textarea label="Notes" value={form.notes} onValueChange={(v) => setForm({ ...form, notes: v })} startContent={<StickyNote className="w-3.5 h-3.5 text-slate-400" />} />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setModalOpen(false)}>Cancel</Button>
            <Button color="primary" className="bg-brand-600" onPress={save}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDialog isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={remove} title="Delete company?" description="This will permanently remove the company and unlink related contacts." confirmLabel="Delete" />

      <ConfirmDialog
        isOpen={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        onConfirm={handleBulkDelete}
        title={`Delete ${selectedCount} companies?`}
        description="This will permanently remove all selected companies from your CRM. This action cannot be undone."
        confirmLabel="Delete All"
      />

      {drawerCompany && <CompanyDrawer company={drawerCompany} onClose={() => setDrawerCompany(null)} />}
    </div>
  );
}
