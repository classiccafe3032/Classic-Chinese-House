export {};

declare global {
  interface Window {
    electronAPI?: {
      printReceipt: (dataUrl: string) => Promise<void>;
    };
  }
}