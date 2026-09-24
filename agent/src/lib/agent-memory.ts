/**
 * Conversation memory for the WhatsApp assistant.
 *
 * Until this existed every message was answered on its own. A real exchange
 * went: "which trucks are most profitable?" — a correct answer — then "can
 * you give it to me as a pdf?", and the assistant replied "Since there is no
 * prior context or conversation history, I need to ask which report they
 * would like". It had answered the first question thirty seconds earlier and
 * had no idea. On a phone, where people write one short line at a time, that
 * is most of a conversation broken.
 *
 * Mastra's Memory, backed by the Postgres the app already runs.
 *
 * ## Why its own Postgres schema
 *
 * The agent and the app share one database, and the app's Prisma owns
 * `public`. Mastra's store creates six tables of its own — mastra_threads,
 * mastra_messages, mastra_resources, mastra_traces, mastra_evals,
 * mastra_workflow_snapshot. Dropped into `public` they are tables Prisma did
 * not create and does not know about, which is drift: `prisma migrate dev`
 * offers to reset the database to resolve it.
 *
 * This repo has already lost a production deploy to almost exactly that. The
 * agent created `whatsapp_session` on boot, the app's migration then tried
 * CREATE TABLE and failed with 42P07, Prisma recorded the migration as
 * failed, and every later deploy stopped at P3009 — see
 * app/prisma/resolve-whatsapp-session-migration.mjs, which exists only to dig
 * that out. Putting Mastra's tables in their own schema means Prisma never
 * sees them and the same class of failure cannot repeat. The store issues
 * CREATE SCHEMA IF NOT EXISTS itself, so nothing has to be provisioned first.
 */

import { Memory } from "@mastra/memory";
import { PostgresStore } from "@mastra/pg";

/** Where Mastra's own tables live. Deliberately not `public` — see above. */
const MEMORY_SCHEMA = "mastra";

/**
 * How many past turns the model is shown.
 *
 * Costed rather than guessed. A turn is already ~5,500 tokens, nearly all of
 * it tool definitions resent every message, so the history is cheap by
 * comparison — but it is not free, and it grows every message in a thread.
 * Ten covers the pattern this exists for, a question and a follow-up that
 * refers to it, with room for a couple of detours in between.
 */
const REMEMBERED_TURNS = Number(process.env.ASSISTANT_MEMORY_TURNS ?? 10);

let memo: Memory | null | undefined;

/**
 * The shared Memory, or null when there is no database to put it in.
 *
 * Null rather than a throw on purpose: an assistant that has forgotten the
 * last message is worse than one that has not, but it is far better than one
 * that will not answer at all. A missing DATABASE_URL should cost the
 * conversation its memory, not the business its assistant.
 *
 * Built once. The Agent is constructed per message — the tools depend on who
 * is asking — and a store per message would open a Postgres pool per message.
 */
export function assistantMemory(): Memory | null {
  if (memo !== undefined) return memo;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn(
      "[memory] DATABASE_URL is not set, so the assistant will not remember " +
        "anything between messages. Set it to give it a conversation.",
    );
    memo = null;
    return memo;
  }

  try {
    memo = new Memory({
      storage: new PostgresStore({
        connectionString,
        schemaName: MEMORY_SCHEMA,
      }),
      options: {
        lastMessages: REMEMBERED_TURNS,

        // Off, and not an oversight. Semantic recall searches older messages
        // by meaning, which needs every message embedded — a second model, a
        // vector index, and a cost on every turn. What went wrong here was
        // the *previous* message being missing, which lastMessages fixes.
        // Turning this on means adding PgVector and an embedder first.
        semanticRecall: false,

        // Also off: this asks the model to invent a thread title, which is an
        // extra LLM call per new conversation for something nobody will read.
        // Threads here are named by phone number and that is enough.
        threads: { generateTitle: false },
      },
    });
    return memo;
  } catch (error) {
    console.error(
      "[memory] could not open the conversation store; carrying on without " +
        "memory:",
      error,
    );
    memo = null;
    return memo;
  }
}

/**
 * Which conversation a message belongs to.
 *
 * Keyed by phone number, which is the only stable identity WhatsApp gives us
 * before the app is asked who this is. One thread per number, for good: the
 * alternative is a new thread per day or per session, and "the report you
 * sent me yesterday" is a real thing people say.
 *
 * Scoping matters more than it looks. Two people with different access levels
 * talk to this same bot, and the thread is what keeps one person's figures
 * out of the other's context window. Never key this on anything an unrelated
 * caller could share.
 */
export function conversationFor(phone: string): {
  thread: string;
  resource: string;
} {
  const id = normalisePhone(phone);
  return { thread: `wa:${id}`, resource: `wa:${id}` };
}

/**
 * WhatsApp gives the same person different-looking addresses — a plain
 * number, an `@c.us` suffix, an `@lid` one on multi-device. Without this, one
 * person gets a fresh empty thread depending on how the message arrived,
 * which looks exactly like the amnesia this module exists to fix.
 */
function normalisePhone(phone: string): string {
  return phone.replace(/@.*$/, "").replace(/\D/g, "");
}
