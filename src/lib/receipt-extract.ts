/**
 * Receipt line-item extraction with Claude vision.
 *
 * Given a receipt image (a public URL), Claude reads the purchased line items
 * and the store name so they can be auto-added as job materials. Degrades
 * gracefully: with no ANTHROPIC_API_KEY the feature is disabled and the API
 * route returns a clear "not set up" message rather than throwing.
 */
import Anthropic from "@anthropic-ai/sdk";

// The extractor is enabled only when a key is present. Kept as a getter-style
// constant so routes can surface a clear setup message when it's missing.
export const hasReceiptExtraction = Boolean(process.env.ANTHROPIC_API_KEY);

export type ExtractedItem = { name: string; priceCents: number };
export type ExtractResult = { store: string | null; items: ExtractedItem[] };

// JSON Schema the model must fill. Prices are dollars (natural on a receipt);
// we convert to integer cents ourselves to avoid model rounding drift.
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    store: {
      type: "string",
      description: "The store or supplier name printed on the receipt, or empty string if not visible.",
    },
    items: {
      type: "array",
      description: "One entry per purchased product line.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string", description: "The product/description as printed." },
          priceDollars: {
            type: "number",
            description: "The line's total price in dollars (unit price × quantity).",
          },
        },
        required: ["name", "priceDollars"],
      },
    },
  },
  required: ["store", "items"],
} as const;

const PROMPT =
  "This is a photo of a store purchase receipt for a handyman/contractor job. " +
  "Extract every purchased product line with its name and its line total price in dollars. " +
  "Include only actual purchased items. Do NOT include subtotal, sales tax, total, tender/change, " +
  "card or cash payment lines, savings, store info, phone numbers, or dates. If a line shows a " +
  "quantity, report the line's total (unit price × quantity), not the unit price. Also read the " +
  "store or supplier name. If the image is not a legible receipt, return an empty items array.";

/**
 * Read a receipt image and return its purchased line items + store name.
 * Returns null when extraction is unavailable or the model output can't be parsed.
 */
export async function extractReceipt(imageUrl: string): Promise<ExtractResult | null> {
  if (!hasReceiptExtraction) return null;

  const client = new Anthropic();
  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4096,
      // Simple OCR-style extraction — no extended thinking needed; keep it lean.
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "url", url: imageUrl } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;

    const parsed = JSON.parse(textBlock.text) as {
      store?: unknown;
      items?: unknown;
    };

    const store =
      typeof parsed.store === "string" && parsed.store.trim()
        ? parsed.store.trim().slice(0, 120)
        : null;

    const items: ExtractedItem[] = [];
    if (Array.isArray(parsed.items)) {
      for (const raw of parsed.items) {
        if (!raw || typeof raw !== "object") continue;
        const r = raw as Record<string, unknown>;
        const name = typeof r.name === "string" ? r.name.trim().slice(0, 200) : "";
        const dollars = typeof r.priceDollars === "number" ? r.priceDollars : Number(r.priceDollars);
        if (!name) continue;
        const priceCents =
          Number.isFinite(dollars) && dollars >= 0 ? Math.round(dollars * 100) : 0;
        items.push({ name, priceCents });
      }
    }

    return { store, items };
  } catch (err) {
    console.error("[receipts] extraction failed:", err);
    return null;
  }
}
