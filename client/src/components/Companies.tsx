import { useState } from 'react';
import { Search, Pencil, Trash2 } from 'lucide-react';
import { useTable, useDb } from '../spacetime/hooks';
import PageHeader from './PageHeader';
import ConfirmDialog from './ConfirmDialog';
import {
  Button, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Card, CardBody, Avatar
} from '@nextui-org/react';

export default function Companies() {
  const db = useDb();
  const [companies] = useTable('companies');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<bigint | null>(null);
  const [form, setForm] = useState({ name: '', registrationNumber: '', industry: '', address: '', billingAddress: '' });

  const filtered = companies.filter((c: any) => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || (c.registrationNumber ?? '').toLowerCase().includes(q);
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', registrationNumber: '', industry: '', address: '', billingAddress: '' });
    setModalOpen(true);
  };

  const openEdit = (company: any) => {
    setEditing(company);
    setForm({
      name: company.name,
      registrationNumber: company.registrationNumber ?? '',
      industry: company.industry ?? '',
      address: company.address,
      billingAddress: company.billingAddress,
    });
    setModalOpen(true);
  };

  const save = () => {
    if (!db || !form.name) return;
    if (editing) {
      (db.reducers as any).updateCompany({
        id: editing.id, name: form.name,
        registrationNumber: form.registrationNumber || undefined,
        industry: form.industry || undefined,
        address: form.address, billingAddress: form.billingAddress,
      });
    } else {
      (db.reducers as any).createCompany({
        tenantId: 1n, name: form.name,
        registrationNumber: form.registrationNumber || undefined,
        industry: form.industry || undefined,
        address: form.address || '{}', billingAddress: form.billingAddress || '{}',
      });
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
    setDeletingId(null);
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
        <CardBody className="p-0">
          <Table removeWrapper aria-label="Companies table" classNames={{ th: 'bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider', td: 'py-3' }}>
            <TableHeader>
              <TableColumn>NAME</TableColumn>
              <TableColumn>REG. NUMBER</TableColumn>
              <TableColumn>INDUSTRY</TableColumn>
              <TableColumn className="text-right">ACTIONS</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No companies found">
              {filtered.map((c: any) => (
                <TableRow key={c.id.toString()} className="hover:bg-slate-50/60 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} size="sm" className="bg-emerald-100 text-emerald-700" />
                      <span className="font-medium text-slate-800">{c.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600">{c.registrationNumber ?? '—'}</TableCell>
                  <TableCell className="text-slate-600">{c.industry ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
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

      <Modal isOpen={modalOpen} onOpenChange={setModalOpen}>
        <ModalContent>
          <ModalHeader className="text-slate-900 font-outfit">{editing ? 'Edit Company' : 'New Company'}</ModalHeader>
          <ModalBody className="gap-4">
            <Input label="Name" value={form.name} onValueChange={(v) => setForm({ ...form, name: v })} isRequired />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Registration Number" value={form.registrationNumber} onValueChange={(v) => setForm({ ...form, registrationNumber: v })} />
              <Input label="Industry" value={form.industry} onValueChange={(v) => setForm({ ...form, industry: v })} />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setModalOpen(false)}>Cancel</Button>
            <Button color="primary" className="bg-brand-600" onPress={save}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDialog isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={remove} title="Delete company?" description="This will permanently remove the company and unlink related contacts." confirmLabel="Delete" />
    </div>
  );
}
