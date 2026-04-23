import { toast } from 'sonner';

export function useToast() {
  const success = (message: string, description?: string) => {
    toast.success(message, { description });
  };

  const error = (message: string, description?: string) => {
    toast.error(message, { description });
  };

  const info = (message: string, description?: string) => {
    toast.info(message, { description });
  };

  return { success, error, info };
}

export { toast };
