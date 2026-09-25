/**
 * Turns a WhatsApp voice note into words the assistant can act on.
 *
 * Most people here are messaging from a yard or a cab, and a voice note is
 * faster than typing a registration one-handed. Until now one arrived, was
 * uploaded to storage as though it were a photographed receipt, and the
 * model was told "the sender attached a file — use this URL as receiptUrl".
 * So someone saying "put two hundred dollars of diesel on KBZ 456H" got
 * asked what the file was for.
 *
 * The assistant's own model reads audio — google/gemini-3.5-flash lists
 * audio among its input modalities on OpenRouter — so this needs no second
 * provider and no extra key.
 *
 * ## Why transcribe first rather than hand the model the audio
 *
 * The audio could be passed straight into the conversation and the model
 * left to hear it. This transcribes in a separate call and feeds the text
 * in, because the text is the audit trail. When a voice note books an
 * expense, somebody will eventually need to know whether the bot heard
 * "two hundred" or "two thousand", and a transcript in the message log
 * answers that. Audio buried in a conversation does not.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Audio big enough to be a problem. A WhatsApp voice note is roughly 1 MB
 * per two minutes; anything past this is not someone dictating an expense,
 * and base64 inflates it by a third before it is even sent.
 */
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

/** What OpenRouter wants in `format`, keyed by what WhatsApp sends. */
const FORMAT_BY_MIME: Record<string, string> = {
  "audio/ogg": "ogg",
  "audio/opus": "ogg",
  "audio/oga": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "aac",
  "audio/flac": "flac",
  "audio/webm": "ogg",
};

/** True when this attachment is something to listen to rather than store. */
export function isAudio(mimeType: string | undefined | null): boolean {
  if (!mimeType) return false;
  return audioFormatFor(mimeType) !== null;
}

/**
 * WhatsApp sends "audio/ogg; codecs=opus"; the parameters are not ours to
 * pass on. Unknown audio types fall back to ogg rather than being refused —
 * a wrong guess costs one failed call, refusing costs the message.
 */
export function audioFormatFor(mimeType: string): string | null {
  const base = mimeType.split(";")[0]!.trim().toLowerCase();
  if (FORMAT_BY_MIME[base]) return FORMAT_BY_MIME[base];
  return base.startsWith("audio/") ? "ogg" : null;
}

export interface Transcript {
  text: string;
  /** Seconds the call took, for the log — these are not instant. */
  tookMs: number;
}

/**
 * Transcribes a voice note, or returns null if it could not be done.
 *
 * Null rather than throwing: a voice note that cannot be transcribed should
 * fall back to the old "a file arrived" behaviour, not lose the message.
 */
export async function transcribeVoiceNote(params: {
  base64: string;
  mimeType: string;
}): Promise<Transcript | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn("[transcribe] no OPENROUTER_API_KEY, so voice notes stay unheard");
    return null;
  }

  const format = audioFormatFor(params.mimeType);
  if (!format) return null;

  // base64 is 4 characters per 3 bytes.
  const bytes = Math.floor((params.base64.length * 3) / 4);
  if (bytes > MAX_AUDIO_BYTES) {
    console.warn(
      `[transcribe] voice note is ${Math.round(bytes / 1024 / 1024)}MB, too long to transcribe`,
    );
    return null;
  }

  const model = process.env.TRANSCRIBE_MODEL || process.env.ASSISTANT_MODEL || "google/gemini-3.5-flash";
  const started = Date.now();

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                // Written for what actually arrives: Zimbabwean English with
                // Shona or Ndebele mixed in, registrations read out letter by
                // letter, and money said aloud.
                text:
                  "Transcribe this voice note word for word. Reply with the transcript " +
                  "and nothing else — no preamble, no summary, no translation, no " +
                  "quotation marks. Keep the speaker's own language, including where " +
                  "they switch between English and Shona or Ndebele mid-sentence. " +
                  "Write vehicle registrations as continuous text (KBZ 456H, not K B Z " +
                  "four five six H) and amounts as digits. If the audio is silent or " +
                  "you cannot make out any words, reply with exactly: (inaudible)",
              },
              {
                type: "input_audio",
                input_audio: { data: params.base64, format },
              },
            ],
          },
        ],
        // A transcript is not a place for invention.
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`[transcribe] OpenRouter said ${response.status}: ${body.slice(0, 300)}`);
      return null;
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content?.trim();

    if (!text || text === "(inaudible)") {
      console.warn("[transcribe] nothing audible in that voice note");
      return null;
    }

    return { text, tookMs: Date.now() - started };
  } catch (error) {
    console.error("[transcribe] could not transcribe the voice note:", error);
    return null;
  }
}
