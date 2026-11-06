export type PublishProgress = {
  userId: string;
  appName: string;
  label: string;
  percent: number;
  status: "uploading" | "processing" | "complete" | "failed" | "cancelled";
  error?: string;
  appId?: string;
  updatedAt: number;
};

const STORAGE_KEY = "niza:publish-progress";
const EVENT_NAME = "niza:publish-progress";
const listeners = new Set<(value: PublishProgress | null) => void>();
let current: PublishProgress | null = null;
let hydrated = false;

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) current = JSON.parse(raw) as PublishProgress;
    if (current && Date.now() - current.updatedAt > 3 * 60 * 60 * 1000) {
      current = { ...current, status: "failed", label: "Submission paused", error: "This submission did not finish. Please return to the upload form and submit again.", updatedAt: Date.now() };
      persist();
    }
  } catch {
    current = null;
  }
}

function persist() {
  try {
    if (current) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Uploading still works when browser storage is unavailable.
  }
}

function emit() {
  persist();
  listeners.forEach((listener) => listener(current));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: current }));
  }
}

export function getPublishProgress(userId?: string): PublishProgress | null {
  hydrate();
  if (userId && current?.userId !== userId) return null;
  return current;
}

export function subscribePublishProgress(listener: (value: PublishProgress | null) => void): () => void {
  hydrate();
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}

export function startPublishProgress(userId: string, appName: string) {
  hydrate();
  current = {
    userId,
    appName,
    label: "Preparing your submission…",
    percent: 0,
    status: "uploading",
    updatedAt: Date.now(),
  };
  emit();
}

export function updatePublishProgress(update: Partial<Pick<PublishProgress, "label" | "percent" | "status" | "error" | "appId">>) {
  hydrate();
  if (!current) return;
  current = { ...current, ...update, updatedAt: Date.now() };
  emit();
}

export function clearPublishProgress(userId?: string) {
  hydrate();
  if (userId && current?.userId !== userId) return;
  current = null;
  emit();
}