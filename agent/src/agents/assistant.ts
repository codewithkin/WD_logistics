/**
 * The assistant that answers a WhatsApp message.
 *
 * Built per caller rather than once at startup, because the tools a person
 * gets depend on the role the admin gave them. A yard hand and the owner are
 * talking to the same bot but are handed different capabilities, and the one
 * with fewer is never even shown the others.
 *
 * The old agent was a single module-level `Agent` with a fixed tool set and a
 * hardcoded list of three phone numbers. This replaces both.
 */

import { Agent } from "@mastra/core/agent";
import { assistantModel } from "../lib/model";
import { buildToolsForCaller, type Attachment } from "../tools/app-tools";
import { logExchange } from "../lib/assistant-client";
import { ASSISTANT_MODEL } from "../lib/model";
import { costOf, type TokenUsage } from "../lib/pricing";

const TODAY = () =>
  new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/**
 * What the assistant is told about itself.
 *
 * Written for the situation it is actually in: someone standing in a yard,
 * on a phone, who wants a number or wants something recorded. Length and
 * hedging are the enemy.
 */
function instructions(params: {
  name: string;
  role: string;
  organizationName: string;
}): string {
  return `You are the WhatsApp assistant for ${params.organizationName}, a trucking and logistics company based in Mutare, Zimbabwe, running across the SADC region.

You are talking to ${params.name}. Their access level is "${params.role}". Today is ${TODAY()}.

## What you are for

People message you from a phone, usually standing in a yard or on the road. They want one of two things: a number, or something recorded. Give them that.

## How to answer

- Lead with the answer. No preamble, no "Certainly!", no restating the question.
- Keep it to what fits on a phone screen. A few lines, not an essay.
- Use *bold* for figures, names and statuses. WhatsApp only understands *bold*, _italic_ and \`\`\`code\`\`\` — never markdown headings, tables or bullet characters other than a plain dash.
- Money always with its currency and thousands separators, as the tools return it.
- Always say what period a figure covers, in the sentence that gives the figure. Nearly every number here depends on a date range, and most tools default to the last month when none is asked for — "$198,167 on fuel" reads as a total and is not one. "$198,167 on fuel last month" is the same answer, true.
- Round numbers in prose, but never alter a figure a tool gave you.
- If a list is long, give the top few and say how many more there are.

## Using the tools

- You have tools for reading data and, depending on ${params.name}'s access, for recording it. Use them; never guess at a figure or invent a record.
- Tools that need an id take one from a listing tool — call the listing tool first rather than inventing an id.
- Prefer the tool that answers the whole question in one call. If you want to compare every truck, use the fleet-wide tool once; do not call a per-truck tool once per truck. Someone is holding a phone waiting for this, and ten round trips is the difference between a four-second answer and a forty-second one.
- Two or three tool calls should settle almost any question. If you find yourself on the fourth, answer with what you have and say what you could not check.
- When a tool says something matched several records, ask which one. Do not pick.
- When a tool returns an error, say what went wrong in plain words and what would fix it. Do not retry the same call.

## Sending documents

- When someone asks you to *send*, *share* or *forward* a report, statement or summary — anything phrased as wanting a document rather than a number — use generate_report. Answering with figures instead is not what they asked for.
- When they just ask what a figure *is*, answer with the figure. Do not produce a document nobody asked for.
- The file arrives in this chat, as an attachment, right after your message. You have not seen its contents and you cannot email it — never say you have emailed something or attached it to anything else. "Sending it now" is the honest phrasing.

## Recording things

- Before a tool that changes data, state back what you are about to do in one line and do it. Do not ask permission for routine entries — they asked you to record it.
- After it, confirm exactly what was recorded, with the amount and what it was attached to.
- If a change needs an admin's approval, say so plainly: the record has not changed yet and an admin has been asked.

## Limits

- If ${params.name} asks for something their access does not allow, say so briefly and suggest they ask an admin. Do not describe what the data would have been.
- You cannot delete anything or move money between accounts. Those are done in the web app on purpose. Say so if asked.
- If you genuinely do not know, say so. Never fill a gap with a plausible number — these are the figures a business makes decisions on.`;
}

export interface AssistantReply {
  text: string;
  didWrite: boolean;
  toolCalls: Array<{ tool: string; args: unknown; ok: boolean }>;
  error?: string;
  /** What this turn cost, when the model reported its usage. */
  usage?: TokenUsage & { costUsd: number | null };
  /** Files to send alongside the reply — a generated report, say. */
  attachments: Attachment[];
}

/**
 * Answers one message.
 *
 * Returns rather than throws: a WhatsApp conversation should get a sentence
 * explaining the problem, not silence.
 */
export async function answerMessage(params: {
  phone: string;
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<AssistantReply> {
  // Building the tool set talks to the app over HTTP, so it can fail. It used
  // to sit outside the try below, which meant a refused or unreachable app
  // threw straight out of answerMessage and took the WhatsApp message handler
  // with it — the sender just got silence.
  let caller: Awaited<ReturnType<typeof buildToolsForCaller>>;
  try {
    caller = await buildToolsForCaller(params.phone);
  } catch (error) {
    console.error("[assistant] could not work out what this caller may do:", error);
    return {
      text:
        "I can't reach the system right now, so I can't answer that. " +
        "Try again in a moment.",
      didWrite: false,
      toolCalls: [],
      attachments: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  if (!caller.authorized) {
    return {
      text:
        "I don't have this number on my list, so I can't help. Ask an admin " +
        "to add you under Settings → Notifications → WhatsApp assistant.",
      didWrite: false,
      toolCalls: [],
      attachments: [],
    };
  }

  const agent = new Agent({
    name: "WD Logistics Assistant",
    instructions: instructions({
      name: caller.name ?? "there",
      role: caller.role ?? "readonly",
      organizationName: "WD Logistics",
    }),
    model: assistantModel(),
    // Tools are built at runtime from the app's manifest, so their types
    // cannot be known statically. The server validates every call against the
    // operation's own schema and required role, so this cast loses no safety
    // that was ever enforced here.
    tools: caller.tools as never,
  });

  try {
    const result = await agent.generate(
      [
        ...(params.history ?? []).map((turn) => ({
          role: turn.role,
          content: turn.content,
        })),
        { role: "user" as const, content: params.message },
      ],
      {
        // Enough hops to list, pick and then act, without letting a confused
        // model loop for a minute while somebody waits on their phone.
        maxSteps: 8,
      },
    );

    const text =
      result.text?.trim() ||
      "I got that, but I don't have anything useful to say back. Try asking a different way.";

    // Token counts come back on the result; the price does not, so it is
    // worked out here and stored with the exchange. Reasoning tokens are
    // billed as output and are most of the cost of a short reply, so they are
    // recorded separately rather than buried in the completion count.
    const raw = result.usage as
      | { promptTokens?: number; completionTokens?: number; totalTokens?: number }
      | undefined;
    const reasoning = (
      result.providerMetadata as
        | { openai?: { reasoningTokens?: number } }
        | undefined
    )?.openai?.reasoningTokens;

    const usage = raw
      ? {
          promptTokens: raw.promptTokens ?? 0,
          completionTokens: raw.completionTokens ?? 0,
          reasoningTokens: reasoning,
          costUsd: costOf(ASSISTANT_MODEL, {
            promptTokens: raw.promptTokens ?? 0,
            completionTokens: raw.completionTokens ?? 0,
          }),
        }
      : undefined;

    await logExchange({
      phone: params.phone,
      direction: "inbound",
      body: params.message,
      toolCalls: caller.toolCalls(),
      didWrite: caller.didWrite(),
      usage,
    });

    return {
      text,
      didWrite: caller.didWrite(),
      toolCalls: caller.toolCalls(),
      attachments: caller.attachments(),
      usage,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong.";
    console.error("[assistant] failed to answer:", error);

    await logExchange({
      phone: params.phone,
      direction: "inbound",
      body: params.message,
      toolCalls: caller.toolCalls(),
      didWrite: caller.didWrite(),
      error: message,
    });

    return {
      text:
        "Something went wrong on my side and I couldn't finish that. " +
        "Try again in a moment, or use the web app if it's urgent.",
      didWrite: caller.didWrite(),
      toolCalls: caller.toolCalls(),
      // A file may have been produced before the failure; sending it is
      // better than silently dropping work the person asked for.
      attachments: caller.attachments(),
      error: message,
    };
  }
}
