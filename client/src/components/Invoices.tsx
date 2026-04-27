import { useState, useEffect } from 'react';
import { Search, Pencil, Trash2, CheckCircle, Eye, X } from 'lucide-react';
import { formatDate } from '../lib/dateUtils';
import { useTable, useDb } from '../spacetime/hooks';
import { useLanguage } from '../i18n/LanguageContext';
import PageHeader from './PageHeader';
import { useNavigation } from '../context/NavigationContext';
import ConfirmDialog from './ConfirmDialog';
import {
  Button, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Card, CardBody, Badge, Select, SelectItem
} from '@nextui-org/react';

const statusColorMap: Record<string, 'default' | 'primary' | 'success' | 'danger' | 'warning'> = {
  Draft: 'default', Sent: 'primary', Paid: 'success', Overdue: 'danger', Cancelled: 'warning',
};

const lhdnColorMap: Record<string, 'warning' | 'success' | 'danger'> = {
  Pending: 'warning', Validated: 'success', Failed: 'danger',
};

export default function Invoices() {
  const { t } = useLanguage();
  const db = useDb();
  const { pendingAction, clearAction } = useNavigation();
  const [invoices] = useTable('invoices');
  const [contacts] = useTable('contacts');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<bigint | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<any | null>(null);
  const [form, setForm] = useState({
    invoiceNumber: '', contactId: '', issueDate: '', dueDate: '',
    subtotal: '', taxAmount: '', total: '', currency: 'MYR', status: 'Draft',
  });

  useEffect(() => {
    if (pendingAction === 'createInvoice') {
      openCreate();
      clearAction();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contactMap = new Map(contacts.map((c: any) => [c.id, c]));

  const filtered = invoices.filter((inv: any) => {
    const q = search.toLowerCase();
    return !q || inv.invoiceNumber.toLowerCase().includes(q) ||
      contactMap.get(inv.contactId)?.name?.toLowerCase().includes(q);
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ invoiceNumber: '', contactId: '', issueDate: '', dueDate: '', subtotal: '', taxAmount: '', total: '', currency: 'MYR', status: 'Draft' });
    setModalOpen(true);
  };

  const openEdit = (inv: any) => {
    setEditing(inv);
    setForm({
      invoiceNumber: inv.invoiceNumber, contactId: inv.contactId.toString(),
      issueDate: new Date(inv.issueDate).toISOString().split('T')[0],
      dueDate: new Date(inv.dueDate).toISOString().split('T')[0],
      subtotal: (Number(inv.subtotal) / 100).toString(),
      taxAmount: (Number(inv.taxAmount) / 100).toString(),
      total: (Number(inv.total) / 100).toString(),
      currency: inv.currency, status: inv.status?.tag ?? 'Draft',
    });
    setModalOpen(true);
  };

  const save = () => {
    if (!db || !form.invoiceNumber || !form.contactId) return;
    const subtotal = BigInt(Math.round(parseFloat(form.subtotal || '0') * 100));
    const tax = BigInt(Math.round(parseFloat(form.taxAmount || '0') * 100));
    const total = BigInt(Math.round(parseFloat(form.total || '0') * 100));
    if (editing) {
      (db.reducers as any).updateInvoice({
        id: editing.id, invoiceNumber: form.invoiceNumber,
        issueDate: new Date(form.issueDate).toISOString(),
        dueDate: new Date(form.dueDate).toISOString(),
        subtotal, taxAmount: tax, total, currency: form.currency,
        status: { tag: form.status },
      });
    } else {
      (db.reducers as any).createInvoice({
        tenantId: 1n, invoiceNumber: form.invoiceNumber,
        contactId: BigInt(form.contactId),
        issueDate: new Date(form.issueDate).toISOString(),
        dueDate: new Date(form.dueDate).toISOString(),
        subtotal, taxAmount: tax, total, currency: form.currency,
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
    (db.reducers as any).deleteInvoice({ id: deletingId });
    setDeletingId(null);
  };

  const statusBadge = (status: string) => (
    <Badge color={statusColorMap[status] ?? 'default'} variant="flat" size="sm" className="font-medium">
      {status}
    </Badge>
  );

  const formatRM = (cents: number) => `RM ${(cents / 100).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-fade-in">
      <PageHeader title={t('invoices.title')} subtitle={t('invoices.subtitle')} actionLabel={t('invoices.newInvoice')} onAction={openCreate} />

      <Card className="border border-slate-100 shadow-sm">
        <CardBody className="py-4">
          <Input
            classNames={{ base: 'max-w-md', inputWrapper: 'bg-slate-50 border-slate-200', input: 'text-sm placeholder:text-slate-400' }}
            placeholder="Search invoices..."
            startContent={<Search className="w-4 h-4 text-slate-400" />}
            value={search}
            onValueChange={setSearch}
          />
        </CardBody>
      </Card>

      <Card className="border border-slate-100 shadow-sm">
        <CardBody className="p-0">
          <Table removeWrapper aria-label="Invoices table" classNames={{ th: 'bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider', td: 'py-3' }}>
            <TableHeader>
              <TableColumn>INVOICE #</TableColumn>
              <TableColumn>CONTACT</TableColumn>
              <TableColumn>TOTAL</TableColumn>
              <TableColumn>STATUS</TableColumn>
              <TableColumn>DUE DATE</TableColumn>
              <TableColumn>LHDN</TableColumn>
              <TableColumn className="text-right">ACTIONS</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No invoices found">
              {filtered.map((inv: any) => (
                <TableRow key={inv.id.toString()} className="hover:bg-slate-50/60 transition-colors">
                  <TableCell className="font-medium text-slate-800">{inv.invoiceNumber}</TableCell>
                  <TableCell className="text-slate-600">{contactMap.get(inv.contactId)?.name ?? '—'}</TableCell>
                  <TableCell className="text-slate-800 font-medium">{formatRM(Number(inv.total))}</TableCell>
                  <TableCell>
                    <Badge color={statusColorMap[inv.status?.tag] ?? 'default'} variant="flat" size="sm" className="font-medium">
                      {inv.status?.tag}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-600">{formatDate(inv.dueDate)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className={`w-3.5 h-3.5 ${inv.lhdnValidationStatus?.tag === 'Validated' ? 'text-emerald-500' : inv.lhdnValidationStatus?.tag === 'Failed' ? 'text-rose-500' : 'text-amber-500'}`} />
                      <Badge color={lhdnColorMap[inv.lhdnValidationStatus?.tag] ?? 'warning'} variant="flat" size="sm" className="font-medium">
                        {inv.lhdnValidationStatus?.tag}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button isIconOnly size="sm" variant="light" className="text-slate-400 hover:text-slate-700" onPress={() => setViewingInvoice(inv)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button isIconOnly size="sm" variant="light" className="text-slate-400 hover:text-slate-700" onPress={() => openEdit(inv)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button isIconOnly size="sm" variant="light" className="text-slate-400 hover:text-rose-600" onPress={() => promptRemove(inv.id)}>
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
          <ModalHeader className="text-slate-900 font-outfit">{editing ? 'Edit Invoice' : 'New Invoice'}</ModalHeader>
          <ModalBody className="gap-4">
            <Input label="Invoice Number" value={form.invoiceNumber} onValueChange={(v) => setForm({ ...form, invoiceNumber: v })} isRequired />
            <Select label="Contact" selectedKeys={form.contactId ? [form.contactId] : []} onSelectionChange={(keys) => setForm({ ...form, contactId: Array.from(keys)[0] as string })} isRequired items={contacts.map((c: any) => ({key: c.id.toString(), label: c.name}))}>
              {(item: any) => <SelectItem key={item.key} textValue={item.label}>{item.label}</SelectItem>}
            </Select>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Issue Date" type="date" value={form.issueDate} onValueChange={(v) => setForm({ ...form, issueDate: v })} />
              <Input label="Due Date" type="date" value={form.dueDate} onValueChange={(v) => setForm({ ...form, dueDate: v })} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Subtotal" type="number" step="0.01" value={form.subtotal} onValueChange={(v) => setForm({ ...form, subtotal: v })} />
              <Input label="Tax" type="number" step="0.01" value={form.taxAmount} onValueChange={(v) => setForm({ ...form, taxAmount: v })} />
              <Input label="Total" type="number" step="0.01" value={form.total} onValueChange={(v) => setForm({ ...form, total: v })} />
            </div>
            {editing && (
              <Select label="Status" selectedKeys={[form.status]} onSelectionChange={(keys) => setForm({ ...form, status: Array.from(keys)[0] as string })} items={Object.keys(statusColorMap).map(s => ({key: s, label: s}))}>
                {(item: any) => <SelectItem key={item.key} textValue={item.label}>{item.label}</SelectItem>}
              </Select>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setModalOpen(false)}>Cancel</Button>
            <Button color="primary" className="bg-brand-600" onPress={save}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* View Invoice Modal */}
      <Modal isOpen={!!viewingInvoice} onOpenChange={() => setViewingInvoice(null)} size="lg">
        <ModalContent>
          {viewingInvoice && (
            <>
              <ModalHeader className="flex items-center justify-between text-slate-900 font-outfit">
                <span>Invoice {viewingInvoice.invoiceNumber}</span>
                <Button isIconOnly size="sm" variant="light" onPress={() => setViewingInvoice(null)}><X className="w-4 h-4" /></Button>
              </ModalHeader>
              <ModalBody className="gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Contact</p>
                    <p className="font-medium text-slate-800">{contactMap.get(viewingInvoice.contactId)?.name ?? '—'}</p>
                  </div>
                  {statusBadge(viewingInvoice.status?.tag)}
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Issue Date</p>
                    <p className="font-medium text-slate-800">{formatDate(viewingInvoice.issueDate)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Due Date</p>
                    <p className="font-medium text-slate-800">{formatDate(viewingInvoice.dueDate)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Currency</p>
                    <p className="font-medium text-slate-800">{viewingInvoice.currency}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Subtotal</p>
                    <p className="font-medium text-slate-800">{formatRM(Number(viewingInvoice.subtotal))}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Tax</p>
                    <p className="font-medium text-slate-800">{formatRM(Number(viewingInvoice.taxAmount))}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Total</p>
                    <p className="font-bold text-slate-900 text-lg">{formatRM(Number(viewingInvoice.total))}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <CheckCircle className={`w-4 h-4 ${viewingInvoice.lhdnValidationStatus?.tag === 'Validated' ? 'text-emerald-500' : viewingInvoice.lhdnValidationStatus?.tag === 'Failed' ? 'text-rose-500' : 'text-amber-500'}`} />
                  <span className="text-sm text-slate-600">LHDN Status: <span className="font-medium">{viewingInvoice.lhdnValidationStatus?.tag}</span></span>
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>

      <ConfirmDialog isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={remove} title="Delete invoice?" description="This will permanently remove the invoice and its line items." confirmLabel="Delete" />
    </div>
  );
}
