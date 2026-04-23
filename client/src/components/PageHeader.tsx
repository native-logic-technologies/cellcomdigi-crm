import { Button } from '@nextui-org/react';
import { Plus } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle: string;
  actionLabel?: string;
  actionIcon?: React.ElementType;
  onAction?: () => void;
}

export default function PageHeader({ title, subtitle, actionLabel, actionIcon: ActionIcon = Plus, onAction }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-semibold font-outfit text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      {actionLabel && onAction && (
        <Button
          color="primary"
          className="bg-brand-600 shadow-sm shadow-brand-200"
          startContent={<ActionIcon className="w-4 h-4" />}
          onPress={onAction}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
