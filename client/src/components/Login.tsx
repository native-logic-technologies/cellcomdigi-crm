import { useState } from 'react';
import { Shield, LogIn, Sparkles } from 'lucide-react';
import { Button, Input, Card, CardBody } from '@nextui-org/react';

interface LoginProps {
  onLogin: (user: { name: string; email: string }) => void;
}

export default function Login({ onLogin }: LoginProps) {
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-brand-50/30 to-slate-100 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-brand-600 mx-auto mb-4 flex items-center justify-center shadow-lg shadow-brand-200">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 font-outfit">CellCom CRM</h1>
          <p className="text-sm text-slate-500 mt-1">Unified sales & customer management</p>
        </div>

        <Card className="border border-slate-100 shadow-xl shadow-slate-200/50">
          <CardBody className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Welcome back</h2>
              <p className="text-sm text-slate-500">Sign in to your account</p>
            </div>

            <div className="space-y-3">
              <Input
                label="Email"
                type="email"
                placeholder="you@company.my"
                value={email}
                onValueChange={setEmail}
                classNames={{ inputWrapper: 'bg-slate-50 border-slate-200' }}
              />
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onValueChange={setPassword}
                classNames={{ inputWrapper: 'bg-slate-50 border-slate-200' }}
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
              Sign In
            </Button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs text-slate-400">or</span>
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
              Enter Demo Mode
            </Button>

            <p className="text-xs text-slate-400 text-center">
              Demo mode auto-seeds sample data for evaluation.
            </p>
          </CardBody>
        </Card>

        <p className="text-xs text-slate-400 text-center mt-6">
          &copy; {new Date().getFullYear()} CellCom Digi. All rights reserved.
        </p>
      </div>
    </div>
  );
}
