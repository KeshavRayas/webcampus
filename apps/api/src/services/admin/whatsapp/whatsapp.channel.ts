export type ChannelReceiver = {
  to: string;
  bodyvar: string[];
};

export type ChannelSendPayload = {
  templateId: string;
  receivers: ChannelReceiver[];
};

export type ChannelSendResult = {
  ok: boolean;
  raw: unknown;
};

export interface MessageChannel {
  readonly name: string;
  send(payload: ChannelSendPayload): Promise<ChannelSendResult>;
}

export function getMessageChannel(name: string = "WHATSAPP"): MessageChannel {
  if (name === "WHATSAPP") return new WhatsAppChannel();
  throw new Error(`Unsupported message channel: ${name}`);
}

const TRUSTSIGNAL_BULK_URL =
  "https://wpapi.trustsignal.io/api/v1/whatsapp/bulk";

export class WhatsAppChannel implements MessageChannel {
  readonly name = "WHATSAPP";

  async send(payload: ChannelSendPayload): Promise<ChannelSendResult> {
    const apiKey = process.env.TRUSTSIGNAL_API_KEY;
    const sender = process.env.WHATSAPP_SENDER_NUMBER;

    if (!apiKey) {
      throw new Error("TRUSTSIGNAL_API_KEY is not configured in .env");
    }
    if (!sender) {
      throw new Error("WHATSAPP_SENDER_NUMBER is not configured in .env");
    }

    const body = {
      sender,
      template_id: payload.templateId,
      receivers: payload.receivers.map((r) => ({
        to: r.to,
        sample: { bodyvar: r.bodyvar },
      })),
    };

    let response: globalThis.Response;
    try {
      response = await fetch(
        `${TRUSTSIGNAL_BULK_URL}?api_key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
    } catch (err) {
      return {
        ok: false,
        raw: {
          networkError: err instanceof Error ? err.message : String(err),
        },
      };
    }

    const raw = await response.json().catch(async () => {
      const text = await response.text().catch(() => "");
      return {
        status: response.status,
        statusText: response.statusText,
        body: text,
      };
    });

    return { ok: response.ok, raw };
  }
}
