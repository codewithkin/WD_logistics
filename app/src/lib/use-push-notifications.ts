"use client";

import { useCallback, useEffect, useState } from "react";

// Web Push subscriptions need the VAPID key as a raw Uint8Array, but env
// vars and JSON only carry strings — this is the standard base64url decode.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

export type PushSupportStatus =
  | "unsupported"
  | "needs-install"
  | "denied"
  | "unsubscribed"
  | "subscribed";

/**
 * True on an iPhone or iPad browser that is not running as an installed app.
 *
 * iOS only delivers web push to a page added to the Home Screen (16.4+), so
 * on Safari proper the Enable button can only ever fail. Detecting it lets
 * the UI say "Add to Home Screen first" instead of silently doing nothing —
 * which is a large slice of "push notifications are not working at all".
 */
function isIosWithoutInstall(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports itself as a Mac, but has a touch screen.
    (ua.includes("Macintosh") && "ontouchend" in document);
  if (!isIos) return false;
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return !standalone;
}

/** Fetched once per page; the key is served at runtime, not baked into the build. */
async function fetchVapidKey(): Promise<{ key?: string; error?: string }> {
  try {
    const response = await fetch("/api/push/public-key");
    const data = await response.json();
    return data.configured
      ? { key: data.key as string }
      : { error: data.error as string };
  } catch {
    return { error: "Could not reach the server to check push configuration." };
  }
}

export function usePushNotifications() {
  const [status, setStatus] = useState<PushSupportStatus>("unsubscribed");
  const [isLoading, setIsLoading] = useState(true);
  /** Set when push cannot work at all here, with the reason. */
  const [configError, setConfigError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setStatus(isIosWithoutInstall() ? "needs-install" : "unsupported");
      setIsLoading(false);
      return;
    }
    if (isIosWithoutInstall()) {
      setStatus("needs-install");
      setIsLoading(false);
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      setIsLoading(false);
      return;
    }
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      setStatus(subscription ? "subscribed" : "unsubscribed");
    } catch {
      setStatus("unsubscribed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    fetchVapidKey().then(({ error }) => {
      if (error) setConfigError(error);
    });
  }, [refreshStatus]);

  const subscribe = useCallback(async () => {
    const { key, error } = await fetchVapidKey();
    if (!key) {
      setConfigError(error ?? "Push notifications are not configured.");
      throw new Error(error ?? "Push notifications are not configured.");
    }

    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus(permission === "denied" ? "denied" : "unsubscribed");
      return;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });

    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });
    if (!response.ok) throw new Error("Failed to save subscription");

    setStatus("subscribed");
    setConfigError(null);
  }, []);

  const unsubscribe = useCallback(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) {
      setStatus("unsubscribed");
      return;
    }

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    }).catch(() => {});

    setStatus("unsubscribed");
  }, []);

  return { status, isLoading, configError, subscribe, unsubscribe };
}
