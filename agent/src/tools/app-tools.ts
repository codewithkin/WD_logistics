/**
 * Mastra tools, built from whatever the app says this caller may do.
 *
 * The tools are not hardcoded here, and that is the point. The app owns the
 * list of operations and the role each one needs; this asks for the caller's
 * manifest and turns it into tools. Two consequences worth stating:
 *
 * - A contact with the `readonly` role is never even *offered* the tool that
 *   records an expense, so the model cannot be talked into trying. And if it
 *   somehow does, the server refuses — the manifest is a convenience, not the
 *   security boundary.
 * - Adding a capability to the app makes it available by message without
 *   touching the agent at all.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { fetchManifest, invoke, type ToolManifestEntry } from "../lib/assistant-client";

/**
 * Turns the JSON Schema the app produced back into a Zod object.
 *
 * Only the shapes the operations actually use are handled — strings, numbers,
 * booleans, enums and flat objects. Anything unrecognised becomes a passthrough
 * rather than throwing, because a tool that half-works beats a crash on
 * startup.
 */
function jsonSchemaToZod(schema: Record<string, unknown>): z.ZodTypeAny {
  const type = schema.type as string | undefined;

  if (Array.isArray(schema.enum)) {
    const values = schema.enum as string[];
    return values.length > 0
      ? z.enum(values as [string, ...string[]])
      : z.string();
  }

  switch (type) {
    case "string":
      return z.string();
    case "number":
    case "integer":
      return z.number();
    case "boolean":
      return z.boolean();
    case "array":
      return z.array(
        schema.items
          ? jsonSchemaToZod(schema.items as Record<string, unknown>)
          : z.unknown(),
      );
    case "object": {
      const properties = (schema.properties ?? {}) as Record<
        string,
        Record<string, unknown>
      >;
      const required = new Set((schema.required as string[]) ?? []);
      const shape: Record<string, z.ZodTypeAny> = {};

      for (const [key, definition] of Object.entries(properties)) {
        let field = jsonSchemaToZod(definition);
        if (typeof definition.description === "string") {
          field = field.describe(definition.description);
        }
        shape[key] = required.has(key) ? field : field.optional();
      }
      return z.object(shape);
    }
    default:
      return z.unknown();
  }
}

/**
 * Builds the tool set for one caller.
 *
 * `phone` is baked into each tool's closure rather than passed as an
 * argument, so the model cannot ask for data as somebody else by putting a
 * different number in a tool call.
 */
export async function buildToolsForCaller(phone: string): Promise<{
  authorized: boolean;
  name?: string;
  role?: string;
  tools: Record<string, ReturnType<typeof createTool>>;
  /** Set true by a tool that changed data, for the transcript. */
  didWrite: () => boolean;
  toolCalls: () => Array<{ tool: string; args: unknown; ok: boolean }>;
}> {
  const manifest = await fetchManifest(phone);

  let wroteSomething = false;
  const calls: Array<{ tool: string; args: unknown; ok: boolean }> = [];

  const tools: Record<string, ReturnType<typeof createTool>> = {};

  for (const entry of manifest.tools as ToolManifestEntry[]) {
    const inputSchema = jsonSchemaToZod(entry.schema) as z.ZodObject<
      Record<string, z.ZodTypeAny>
    >;

    tools[entry.name] = createTool({
      id: entry.name,
      description: entry.writes
        ? `${entry.description} (This changes data.)`
        : entry.description,
      inputSchema,
      execute: async ({ context }: { context: Record<string, unknown> }) => {
        const result = await invoke(phone, entry.name, context ?? {});
        calls.push({ tool: entry.name, args: context, ok: result.success });

        if (result.success && result.writes) wroteSomething = true;

        // Errors come back as data rather than thrown, so the model can
        // explain the problem instead of the turn dying. "That matches three
        // trucks, which one?" is a useful answer.
        return result.success
          ? result.data
          : { error: result.error ?? "That didn't work." };
      },
    });
  }

  return {
    authorized: manifest.authorized,
    name: manifest.name,
    role: manifest.role,
    tools,
    didWrite: () => wroteSomething,
    toolCalls: () => calls,
  };
}
