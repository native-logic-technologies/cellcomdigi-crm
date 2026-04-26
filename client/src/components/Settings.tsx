import { useState, useEffect } from 'react';
import { User, Building2, Phone, Globe, Briefcase, FileText, Save } from 'lucide-react';
import { useTable, useDb } from '../spacetime/hooks';
import { useToast } from '../hooks/useToast';
import PageHeader from './PageHeader';
import {
  Card, CardBody, Button, Input, Textarea, Tabs, Tab,
  Avatar, Badge
} from '@nextui-org/react';

export default function Settings() {
  const db = useDb();
  const { success } = useToast();
  const [users] = useTable('users');
  const [companies] = useTable('companies');

  const user = users[0];
  const company = companies[0];

  const [profileForm, setProfileForm] = useState({ name: '', email: '', phone: '' });
  const [companyForm, setCompanyForm] = useState({
    name: '', industry: '', phone: '', email: '', website: '', bio: '',
  });

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name ?? '',
        email: user.email ?? '',
        phone: user.phone ?? '',
      });
    }
  }, [user]);

  useEffect(() => {
    if (company) {
      setCompanyForm({
        name: company.name ?? '',
        industry: company.industry ?? '',
        phone: company.phone ?? '',
        email: company.email ?? '',
        website: company.website ?? '',
        bio: company.notes ?? '',
      });
    }
  }, [company]);

  const saveProfile = () => {
    if (!db || !user) return;
    (db.reducers as any).updateUser({
      id: user.id,
      name: profileForm.name,
      email: profileForm.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
    });
    success('Profile updated', 'Your profile has been saved.');
  };

  const saveCompany = () => {
    if (!db || !company) return;
    (db.reducers as any).updateCompany({
      id: company.id,
      name: companyForm.name,
      registrationNumber: company.registrationNumber,
      industry: companyForm.industry || undefined,
      phone: companyForm.phone || undefined,
      email: companyForm.email || undefined,
      website: companyForm.website || undefined,
      address: company.address,
      billingAddress: company.billingAddress,
      notes: companyForm.bio,
    });
    success('Company profile updated', `${companyForm.name} has been saved.`);
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto animate-fade-in">
      <PageHeader title="Settings" subtitle="Manage your profile and company information" />

      <Tabs
        aria-label="Settings tabs"
        classNames={{
          tabList: 'gap-6 bg-transparent',
          cursor: 'bg-brand-600',
          tab: 'text-sm font-medium text-slate-500',
          tabContent: 'group-data-[selected=true]:text-brand-600',
          panel: 'px-0 py-4',
        }}
      >
        <Tab key="profile" title={<span className="flex items-center gap-2"><User className="w-4 h-4" /> Profile</span>}>
          <Card className="border border-slate-100 shadow-sm">
            <CardBody className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <Avatar
                  name={profileForm.name || 'U'}
                  size="lg"
                  className="bg-gradient-to-br from-brand-500 to-brand-700 text-white"
                />
                <div>
                  <h3 className="font-semibold text-slate-900">{profileForm.name || 'Your Name'}</h3>
                  <p className="text-sm text-slate-500">{profileForm.email || 'your@email.com'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Full Name"
                  value={profileForm.name}
                  onValueChange={(v) => setProfileForm({ ...profileForm, name: v })}
                  startContent={<User className="w-4 h-4 text-slate-400" />}
                />
                <Input
                  label="Email"
                  type="email"
                  value={profileForm.email}
                  onValueChange={(v) => setProfileForm({ ...profileForm, email: v })}
                  startContent={<FileText className="w-4 h-4 text-slate-400" />}
                />
              </div>

              <div className="flex justify-end">
                <Button color="primary" className="bg-brand-600" startContent={<Save className="w-4 h-4" />} onPress={saveProfile}>
                  Save Profile
                </Button>
              </div>
            </CardBody>
          </Card>
        </Tab>

        <Tab key="company" title={<span className="flex items-center gap-2"><Building2 className="w-4 h-4" /> Company</span>}>
          <Card className="border border-slate-100 shadow-sm">
            <CardBody className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-lg">
                  {companyForm.name.charAt(0) || 'C'}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{companyForm.name || 'Company Name'}</h3>
                  <Badge variant="flat" size="sm" className="mt-1 bg-slate-100 text-slate-600">{companyForm.industry || 'No industry set'}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Company Name"
                  value={companyForm.name}
                  onValueChange={(v) => setCompanyForm({ ...companyForm, name: v })}
                  startContent={<Building2 className="w-4 h-4 text-slate-400" />}
                />
                <Input
                  label="Industry"
                  value={companyForm.industry}
                  onValueChange={(v) => setCompanyForm({ ...companyForm, industry: v })}
                  startContent={<Briefcase className="w-4 h-4 text-slate-400" />}
                />
                <Input
                  label="Phone Number"
                  value={companyForm.phone}
                  onValueChange={(v) => setCompanyForm({ ...companyForm, phone: v })}
                  startContent={<Phone className="w-4 h-4 text-slate-400" />}
                />
                <Input
                  label="Email"
                  type="email"
                  value={companyForm.email}
                  onValueChange={(v) => setCompanyForm({ ...companyForm, email: v })}
                  startContent={<FileText className="w-4 h-4 text-slate-400" />}
                />
                <Input
                  label="Website"
                  value={companyForm.website}
                  onValueChange={(v) => setCompanyForm({ ...companyForm, website: v })}
                  startContent={<Globe className="w-4 h-4 text-slate-400" />}
                />
              </div>

              <Textarea
                label="Company Bio / Notes"
                value={companyForm.bio}
                onValueChange={(v) => setCompanyForm({ ...companyForm, bio: v })}
                placeholder="Tell us about your company..."
                minRows={4}
              />

              <div className="flex justify-end">
                <Button color="primary" className="bg-brand-600" startContent={<Save className="w-4 h-4" />} onPress={saveCompany}>
                  Save Company Profile
                </Button>
              </div>
            </CardBody>
          </Card>
        </Tab>
      </Tabs>
    </div>
  );
}
