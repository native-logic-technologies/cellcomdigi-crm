import { useState } from 'react';
import { Search, Pencil, Trash2, RefreshCw, Store } from 'lucide-react';
import { useTable, useDb } from '../spacetime/hooks';
import PageHeader from './PageHeader';
import ConfirmDialog from './ConfirmDialog';
import {
  Button, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Card, CardBody
} from '@nextui-org/react';

export default function Products() {
  const db = useDb();
  const [products] = useTable('products');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<bigint | null>(null);
  const [form, setForm] = useState({ name: '', sku: '', description: '', price: '', cost: '', currency: 'MYR', stock: '' });

  const filtered = products.filter((p: any) => {
    const q = search.toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q);
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', sku: '', description: '', price: '', cost: '', currency: 'MYR', stock: '' });
    setModalOpen(true);
  };

  const openEdit = (product: any) => {
    setEditing(product);
    setForm({
      name: product.name, sku: product.sku ?? '', description: product.description ?? '',
      price: (Number(product.price) / 100).toString(),
      cost: product.cost ? (Number(product.cost) / 100).toString() : '',
      currency: product.currency,
      stock: product.stockQuantity?.toString() ?? '',
    });
    setModalOpen(true);
  };

  const save = () => {
    if (!db || !form.name) return;
    const price = BigInt(Math.round(parseFloat(form.price || '0') * 100));
    const cost = form.cost ? BigInt(Math.round(parseFloat(form.cost) * 100)) : undefined;
    const stock = form.stock ? parseInt(form.stock) : undefined;
    if (editing) {
      (db.reducers as any).updateProduct({
        id: editing.id, name: form.name, sku: form.sku || undefined,
        description: form.description || undefined, price, cost,
        currency: form.currency, stockQuantity: stock,
      });
    } else {
      (db.reducers as any).createProduct({
        tenantId: 1n, name: form.name, sku: form.sku || undefined,
        description: form.description || undefined, price, cost,
        currency: form.currency, stockQuantity: stock,
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
    (db.reducers as any).deleteProduct({ id: deletingId });
    setDeletingId(null);
  };

  const formatRM = (cents: number) => `RM ${(cents / 100).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-fade-in">
      <PageHeader title="Products" subtitle="Manage your product catalog" actionLabel="Add Product" onAction={openCreate} />

      <Card className="border border-slate-100 shadow-sm">
        <CardBody className="py-4">
          <Input
            classNames={{ base: 'max-w-md', inputWrapper: 'bg-slate-50 border-slate-200', input: 'text-sm placeholder:text-slate-400' }}
            placeholder="Search products..."
            startContent={<Search className="w-4 h-4 text-slate-400" />}
            value={search}
            onValueChange={setSearch}
          />
        </CardBody>
      </Card>

      <Card className="border border-slate-100 shadow-sm">
        <CardBody className="p-0">
          <Table removeWrapper aria-label="Products table" classNames={{ th: 'bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider', td: 'py-3' }}>
            <TableHeader>
              <TableColumn>NAME</TableColumn>
              <TableColumn>SKU</TableColumn>
              <TableColumn>PRICE</TableColumn>
              <TableColumn>COST</TableColumn>
              <TableColumn>STOCK</TableColumn>
              <TableColumn className="text-right">ACTIONS</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No products found">
              {filtered.map((p: any) => (
                <TableRow key={p.id.toString()} className="hover:bg-slate-50/60 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-brand-100 text-brand-700 shrink-0">
                        <span className="text-xs font-bold">{p.name.charAt(0)}</span>
                      </div>
                      <span className="font-medium text-slate-800 truncate">{p.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600">{p.sku ?? '—'}</TableCell>
                  <TableCell className="text-slate-800 font-medium">{formatRM(Number(p.price))}</TableCell>
                  <TableCell className="text-slate-600">{p.cost ? formatRM(Number(p.cost)) : '—'}</TableCell>
                  <TableCell className="text-slate-600">{p.stockQuantity ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button isIconOnly size="sm" variant="light" className="text-slate-400 hover:text-slate-700" onPress={() => openEdit(p)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button isIconOnly size="sm" variant="light" className="text-slate-400 hover:text-rose-600" onPress={() => promptRemove(p.id)}>
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
          <ModalHeader className="text-slate-900 font-outfit">{editing ? 'Edit Product' : 'New Product'}</ModalHeader>
          <ModalBody className="gap-4">
            <Input label="Name" value={form.name} onValueChange={(v) => setForm({ ...form, name: v })} isRequired />
            <div className="grid grid-cols-2 gap-4">
              <Input label="SKU" value={form.sku} onValueChange={(v) => setForm({ ...form, sku: v })} />
              <Input label="Stock" type="number" value={form.stock} onValueChange={(v) => setForm({ ...form, stock: v })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Price (RM)" type="number" step="0.01" value={form.price} onValueChange={(v) => setForm({ ...form, price: v })} />
              <Input label="Cost (RM)" type="number" step="0.01" value={form.cost} onValueChange={(v) => setForm({ ...form, cost: v })} />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setModalOpen(false)}>Cancel</Button>
            <Button color="primary" className="bg-brand-600" onPress={save}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Shop sync section */}
      <Card className="border border-slate-100 shadow-sm">
        <CardBody className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-slate-500" />
              <h3 className="font-semibold text-slate-800">Shop Integrations</h3>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {['Shopify', 'Shopee', 'Lazada'].map((shop) => {
              const connected = localStorage.getItem(`shop_${shop.toLowerCase()}`) === 'true';
              return (
                <div key={shop} className={`flex items-center justify-between p-3 rounded-xl border ${connected ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${connected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                      {shop.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{shop}</p>
                      <p className="text-[10px] text-slate-400">{connected ? 'Synced' : 'Not connected'}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={connected ? 'light' : 'bordered'}
                    className="h-7 px-2 text-xs"
                    onPress={() => {
                      const key = `shop_${shop.toLowerCase()}`;
                      if (connected) localStorage.removeItem(key);
                      else localStorage.setItem(key, 'true');
                      window.location.reload();
                    }}
                  >
                    {connected ? <RefreshCw className="w-3 h-3" /> : 'Connect'}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <ConfirmDialog isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={remove} title="Delete product?" description="This will permanently remove the product from your catalog." confirmLabel="Delete" />
    </div>
  );
}
