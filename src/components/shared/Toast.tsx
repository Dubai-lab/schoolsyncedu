import { Toaster, toast } from 'sonner';

/** Drop <ToastProvider /> once in your root layout (main.tsx or App.tsx) */
export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        className: 'text-sm',
        style: {
          borderRadius: '0.75rem',
        },
      }}
      richColors
      closeButton
    />
  );
}

/** Convenience wrappers around sonner's toast */
export const notify = {
  success: (message: string, description?: string) =>
    toast.success(message, { description }),
  error: (message: string, description?: string) =>
    toast.error(message, { description }),
  info: (message: string, description?: string) =>
    toast.info(message, { description }),
  warning: (message: string, description?: string) =>
    toast.warning(message, { description }),
  promise: toast.promise,
};