import {
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button
} from '@nextui-org/react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
}

export default function ConfirmDialog({
  isOpen, onClose, onConfirm, title = 'Are you sure?', description = 'This action cannot be undone.',
  confirmLabel = 'Confirm', cancelLabel = 'Cancel', isDanger = true,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} size="sm">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          {isDanger && <AlertTriangle className="w-5 h-5 text-rose-500" />}
          <span>{title}</span>
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-slate-500">{description}</p>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>{cancelLabel}</Button>
          <Button color={isDanger ? 'danger' : 'primary'} onPress={() => { onConfirm(); onClose(); }}>
            {confirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
