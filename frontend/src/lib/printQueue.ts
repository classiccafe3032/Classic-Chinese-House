/**
 * Sequential Print Queue - Electron-based silent printing
 * Handles retries, deduplication, and queue state tracking
 */

import { buildReceiptCanvas, buildKotCanvas, buildZReportCanvas, type ReceiptData, type ZReportData } from "./receiptGenerator";
import { Capacitor } from "@capacitor/core";
import { printReceiptNative } from "./thermalPrinter";
import { apiGetBusinessSettings } from "./apiClient";

/* ─── Types ─── */
export interface PrintJob {
  id: string;
  type: "receipt" | "kot" | "zreport";
  data: ReceiptData | ZReportData;
  retries: number;
}

type QueueListener = (state: {
  pending: number;
  current: string | null;
  failed: string[];
}) => void;

/* ─── Device checks ─── */
export function isElectron(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as any).electronAPI !== "undefined"
  );
}

export function isAndroid(): boolean {
  return (
    typeof navigator !== "undefined" &&
    /android/i.test(navigator.userAgent || navigator.vendor || (window as any).opera)
  );
}

export function isAutoPrintSupported(): boolean {
  return isElectron() || isAndroid();
}

/* ─── Constants ─── */
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;      // delay before retry
const POST_PRINT_DELAY = 500;  // delay after success (avoid printer overload)

/* ─── Singleton Queue ─── */
class PrintQueue {
  private queue: PrintJob[] = [];
  private processing = false;
  private knownIds = new Set<string>();
  private failedIds: string[] = [];
  private currentJobId: string | null = null;
  private listeners = new Set<QueueListener>();
  private cachedPrinterWidth: string | null = null;
  private cachedBusinessData: { restaurantName: string; address?: string; phone?: string; gstin?: string | null } | null = null;
  private lastSettingsFetchTime = 0;
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("business-settings-updated", () => {
        this.cachedBusinessData = null;
        this.lastSettingsFetchTime = 0;
        console.log("[PrintQueue] Business settings cache invalidated");
      });
    }
  }

  /* ─── Subscribe to queue state ─── */
  subscribe(fn: QueueListener) {
    this.listeners.add(fn);
    fn(this.state);

    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify() {
    const snapshot = this.state;
    this.listeners.forEach((fn) => fn(snapshot));
  }

  /* ─── Public state ─── */
  get state() {
    return {
      pending: this.queue.length,
      current: this.currentJobId,
      failed: [...this.failedIds],
    };
  }

  /* ─── Add job to queue ─── */
  enqueue(id: string, type: "receipt" | "kot" | "zreport", data: ReceiptData | ZReportData) {
    if (!isAutoPrintSupported()) return;

    // prevent duplicates
    if (this.knownIds.has(id)) return;

    this.knownIds.add(id);
    this.queue.push({ id, type, data, retries: 0 });

    console.log("[PrintQueue] Enqueued:", id);

    this.notify();
    this.processNext();
  }

  /* ─── Retry failed jobs manually ─── */
  retryFailed() {
    const ids = [...this.failedIds];
    this.failedIds = [];

    for (const id of ids) {
      this.knownIds.delete(id); // allow re-enqueue
    }

    console.log("[PrintQueue] Retrying failed jobs:", ids);

    this.notify();
  }

  /* ─── Core processor ─── */
  private async processNext() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    const job = this.queue.shift()!;
    this.currentJobId = job.id;
    this.notify();

    console.log("[PrintQueue] Printing:", job.id);

    try {
      await this.executePrint(job);

      // success delay
      await delay(POST_PRINT_DELAY);
    } catch (err) {
      console.warn(
        `[PrintQueue] Failed ${job.id} (attempt ${job.retries + 1})`,
        err
      );

      job.retries += 1;

      if (job.retries < MAX_RETRIES) {
        // retry
        this.queue.unshift(job);
        await delay(RETRY_DELAY);
      } else {
        console.error(
          `[PrintQueue] Permanently failed: ${job.id}`
        );
        this.failedIds.push(job.id);
      }
    }

    this.currentJobId = null;
    this.processing = false;
    this.notify();

    // process next job
    this.processNext();
  }

  /* ─── Actual print execution (Electron or Android) ─── */
  private async executePrint(job: PrintJob): Promise<void> {
    let canvas: HTMLCanvasElement;
    
    if (job.type === "kot") {
      canvas = buildKotCanvas(job.data as ReceiptData);
    } else if (job.type === "zreport") {
      canvas = buildZReportCanvas(job.data as ZReportData);
    } else {
      canvas = buildReceiptCanvas(job.data as ReceiptData);
    }

    const dataUrl = canvas.toDataURL("image/png");

    if (Capacitor.isNativePlatform()) {
      console.log("[PrintQueue] Dispatching Native Bluetooth Print for Capacitor");
      
      let businessData: { restaurantName: string; address?: string; phone?: string; gstin?: string | null } = { 
        restaurantName: "The Chinese House"
      };
      
      const now = Date.now();
      if (!this.cachedBusinessData || (now - this.lastSettingsFetchTime) > this.CACHE_TTL) {
        try {
          const settings = await apiGetBusinessSettings();
          this.cachedPrinterWidth = settings.printerWidth || "58mm";
          this.cachedBusinessData = {
            restaurantName: settings.restaurantName || "The Chinese House",
            address: settings.address,
            phone: settings.phone,
            gstin: settings.gstin
          };
          this.lastSettingsFetchTime = now;
        } catch {
          this.cachedPrinterWidth = this.cachedPrinterWidth || "58mm";
        }
      }

      if (this.cachedBusinessData) {
        businessData = { ...this.cachedBusinessData };
      }
      
      if (job.type === "zreport") {
        const d = job.data as ZReportData;
        if (d.business?.restaurantName) {
          businessData.restaurantName = d.business.restaurantName;
        }
        if (d.business?.address) {
          businessData.address = d.business.address;
        }
        
        // Import printZReportNative dynamically or statically
        const { printZReportNative } = await import("./thermalPrinter");
        const success = await printZReportNative(d, businessData, this.cachedPrinterWidth || "58mm");
        if (!success) {
          throw new Error("Native Z-Report print failed");
        }
        return;
      } else {
        const d = job.data as ReceiptData;
        if (d.business?.restaurantName) {
          businessData.restaurantName = d.business.restaurantName;
        }
        if (d.business?.address) {
          businessData.address = d.business.address;
        }
        if (d.business?.gstin) {
          businessData.gstin = d.business.gstin;
        }
        const success = await printReceiptNative(d as any, businessData, this.cachedPrinterWidth, job.type === "kot");
        if (!success) {
           throw new Error("Native print failed");
        }
        return;
      }
    } else if (isAndroid()) {
      console.log("[PrintQueue] Dispatching RawBT Intent for Android browser");
      const base64Data = dataUrl.split(",")[1];
      const intentUrl = `intent:${base64Data}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
      window.location.href = intentUrl;
      return;
    }

    if (!(window as any).electronAPI) {
      console.warn("[PrintQueue] Not in Electron or Android, skipping print");
      return;
    }

    // 🔥 THIS is the key - call Electron
    await (window as any).electronAPI.printReceipt(dataUrl);
  }
}

/* ─── Helper delay ─── */
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ─── Export singleton ─── */
export const printQueue = new PrintQueue();