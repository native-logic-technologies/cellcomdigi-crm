import { useState } from 'react';
import { LogIn, Sparkles, Globe } from 'lucide-react';
import { Button, Input, Card, CardBody } from '@nextui-org/react';
import { useLanguage } from '../i18n/LanguageContext';
import type { Lang } from '../i18n/dictionary';

interface LoginProps {
  onLogin: (user: { name: string; email: string }) => void;
}

const LANG_OPTIONS: { value: Lang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ms', label: 'Bahasa Melayu' },
  { value: 'zh', label: '中文' },
];

export default function Login({ onLogin }: LoginProps) {
  const { t, lang, setLang } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    setTimeout(() => {
      onLogin({ name: 'Demo User', email: email || 'demo@cellcom.my' });
      setLoading(false);
    }, 800);
  };

  const handleDemo = () => {
    setLoading(true);
    setTimeout(() => {
      onLogin({ name: 'Aisyah Rahman', email: 'aisyah@cellcom.my' });
      setLoading(false);
    }, 600);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-brand-50/30 to-slate-100 dark:from-[#0a1628] dark:via-[#0f1f3a] dark:to-[#0a1628] px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src="/celcomdigi-logo.svg"
            alt="CelcomDigi"
            className="h-12 w-auto mx-auto mb-4"
          />
        </div>

        <Card className="border border-slate-100 shadow-xl shadow-slate-200/50">
          <CardBody className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('login.welcomeBack')}</h2>
              <p className="text-sm text-slate-500">{t('login.signInToAccount')}</p>
            </div>

            <div className="space-y-3">
              <Input
                label={t('login.email')}
                type="email"
                placeholder="you@company.my"
                value={email}
                onValueChange={setEmail}
                classNames={{ inputWrapper: 'bg-slate-50 border-slate-200 dark:bg-[#0f1f3a] dark:border-[#1e3a5f]' }}
              />
              <Input
                label={t('login.password')}
                type="password"
                placeholder="••••••••"
                value={password}
                onValueChange={setPassword}
                classNames={{ inputWrapper: 'bg-slate-50 border-slate-200 dark:bg-[#0f1f3a] dark:border-[#1e3a5f]' }}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>

            <Button
              color="primary"
              className="bg-brand-600 w-full"
              size="lg"
              onPress={handleLogin}
              isLoading={loading}
              startContent={!loading && <LogIn className="w-4 h-4" />}
            >
              {t('login.signIn')}
            </Button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white dark:bg-[#152a4a] px-3 text-xs text-slate-400">{t('login.or')}</span>
              </div>
            </div>

            <Button
              variant="bordered"
              className="w-full border-brand-200 text-brand-700 hover:bg-brand-50"
              size="lg"
              onPress={handleDemo}
              isLoading={loading}
              startContent={!loading && <Sparkles className="w-4 h-4" />}
            >
              {t('login.enterDemo')}
            </Button>

            <p className="text-xs text-slate-400 text-center">
              {t('login.demoHint')}
            </p>

            {/* Language selector */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-center gap-2">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-400">{t('login.language')}</span>
                <div className="flex gap-1">
                  {LANG_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setLang(opt.value)}
                      className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors ${
                        lang === opt.value
                          ? 'bg-brand-100 text-brand-700'
                          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <p className="text-xs text-slate-400 text-center mt-6">
          &copy; {new Date().getFullYear()} CelcomDigi. All rights reserved.
        </p>
      </div>
    </div>
  );
}
