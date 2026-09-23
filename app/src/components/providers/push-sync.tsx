"use client";

/**
 * Keeps this device's push subscription pointed at whoever is signed in.
 *
 * The service worker used to be registered only when someone pressed
 * "Enable", which left three ways for push to go quietly dead:
 *
 * - the worker was never registered again after a browser update or a
 *   cleared cache, so an existing subscription had nothing listening;
 * - a browser rotated the subscription's keys, and the server kept sending to
 *   the old endpoint forever;
 * - on a shared office machine, a subscription created by one user kept
 *   delivering that user's notifications to the next person to sign in.
 *
 * Registering on every load for a signed-in user and re-posting whatever
 * subscription exists fixes all three: the upsert re-points the endpoint at
 * the current user.
 */

import { useEffect } from "react";

export function PushSync({ userId }: { userId: string }) {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      return;
    }

    let cancelled = false;

    const sync = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        if (cancelled) return;

        // Only re-sync a subscription that already exists. Creating one here
        // would prompt for permission on page load, which is both hostile and
        // a good way to get permanently blocked by the browser.
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription || cancelled) return;

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
        });
      } catch {
        // A failed re-sync must never break the page; the user can still
        // press Enable, and the delivery log records what happened.
      }
    };

    sync();
    return () => {
      cancelled = true;
    };
    // Re-runs when a different user signs in on this device.
  }, [userId]);

  return null;
}
