import { Zap, Clock, Mail, CheckSquare, PenLine, GitBranch, Flag, ArrowDown } from 'lucide-react';
import type { WorkflowStep } from '../services/ai';

const STEP_ICONS: Record<string, React.ElementType> = {
  trigger: Zap,
  wait: Clock,
  send_email: Mail,
  create_task: CheckSquare,
  update_field: PenLine,
  condition: GitBranch,
  end: Flag,
};

const STEP_COLORS: Record<string, string> = {
  trigger: 'bg-brand-100 text-brand-700 border-brand-200',
  wait: 'bg-amber-50 text-amber-700 border-amber-200',
  send_email: 'bg-sky-50 text-sky-700 border-sky-200',
  create_task: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  update_field: 'bg-slate-100 text-slate-700 border-slate-200',
  condition: 'bg-rose-50 text-rose-700 border-rose-200',
  end: 'bg-slate-100 text-slate-500 border-slate-200',
};

interface WorkflowCanvasProps {
  steps: WorkflowStep[];
  onStepClick?: (step: WorkflowStep) => void;
  emailTemplate?: { subject: string; body: string };
}

export default function WorkflowCanvas({ steps, onStepClick, emailTemplate }: WorkflowCanvasProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-4">
      {steps.map((step, index) => {
        const Icon = STEP_ICONS[step.type] || Zap;
        const colors = STEP_COLORS[step.type] || 'bg-slate-100 text-slate-700 border-slate-200';
        return (
          <div key={step.id} className="flex flex-col items-center gap-2 w-full max-w-md">
            <button
              onClick={() => onStepClick?.(step)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border ${colors} hover:shadow-md transition-all duration-200 text-left`}
            >
              <div className={`p-2.5 rounded-lg bg-white/70`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{step.label}</p>
                {step.type === 'send_email' && emailTemplate && (
                  <p className="text-xs opacity-70 mt-0.5 truncate">{emailTemplate.subject}</p>
                )}
                {step.type === 'wait' && step.config.duration && (
                  <p className="text-xs opacity-70 mt-0.5">Duration: {step.config.duration}</p>
                )}
                {step.type === 'condition' && step.config.field && (
                  <p className="text-xs opacity-70 mt-0.5">{step.config.field} {step.config.op} {step.config.value}</p>
                )}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-50">{step.type}</span>
            </button>
            {index < steps.length - 1 && (
              <ArrowDown className="w-4 h-4 text-slate-300" />
            )}
          </div>
        );
      })}
    </div>
  );
}
