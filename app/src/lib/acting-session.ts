import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import type { ServerSession } from "@/lib/session";

/**
 * Lets a non-browser caller run server actions as a real user.
 *
 * The WhatsApp assistant reaches the app through an API route with a shared
 * secret, so there is no better-auth cookie. Every write action in this
 * codebase starts with `requireAuth()`, which `redirect()`s when there is no
 * session — inside an API route that surfaces as a thrown `NEXT_REDIRECT` and
 * the write looks like a crash rather than a refusal.
 *
 * The alternative was to rebuild each write against Prisma directly, which is
 * exactly how the two ledgers drift apart: an expense recorded by message would
 * skip the account debit, the edit-request gate and the notification that the
 * web form does. So instead the caller is given a session for the duration of
 * one operation, and the real action runs unchanged.
 *
 * Two rules keep this from becoming a back door:
 *
 *  - The session must name a real `Member` row. The role comes from that row,
 *    never from the WhatsApp contact, so nobody gains access by being given a
 *    generous role on the contact list.
 *  - It is scoped to a single operation via `runAsActor`. `AsyncLocalStorage`
 *    keeps it on one async chain, so concurrent requests cannot see each
 *    other's actor.
 */
const store = new AsyncLocalStorage<ServerSession>();

/** The acting session, if this call chain is running as one. */
export function getActingSession(): ServerSession | null {
  return store.getStore() ?? null;
}

/** Runs `fn` with `session` as the current user. */
export function runAsActor<T>(session: ServerSession, fn: () => Promise<T>): Promise<T> {
  return store.run(session, fn);
}
