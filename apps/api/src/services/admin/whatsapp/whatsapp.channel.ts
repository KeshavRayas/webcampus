export type ChannelReceiver = {
  to: string;
  bodyvar?: string[];
  message?: string;
};

export type ChannelSendPayload = {
  templateId?: string;
  smsTemplateId?: string;
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
  if (name === "SMS") return new SmsChannel();
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
    if (!payload.templateId) {
      throw new Error("WhatsApp template requires an external template id");
    }

    const body = {
      sender,
      template_id: payload.templateId,
      receivers: payload.receivers.map((r) => ({
        to: r.to,
        sample: { bodyvar: r.bodyvar ?? [] },
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

const DEFAULT_SMS_API_URL =
  "https://sms.versatilesmshub.com/api/smsservices.php";

export class SmsChannel implements MessageChannel {
  readonly name = "SMS";

  async send(payload: ChannelSendPayload): Promise<ChannelSendResult> {
    const apiKey = process.env.SMS_API_KEY;
    const senderId = process.env.SMS_SENDER_ID;

    if (!apiKey) {
      throw new Error("SMS_API_KEY is not configured in .env");
    }
    if (!senderId) {
      throw new Error("SMS_SENDER_ID is not configured in .env");
    }

    const body = {
      api: apiKey,
      senderid: senderId,
      campaignid: `wc-${Date.now()}`,
      channel: "Trans",
      templateid: payload.smsTemplateId ?? "",
      dcs: "0",
      shorturl: "YES",
      data: payload.receivers.map((r) => ({
        international: "NO",
        TransactionId: "",
        countrycode: "",
        number: r.to,
        message: r.message ?? "",
      })),
    };

    const apiUrl = process.env.SMS_API_URL || DEFAULT_SMS_API_URL;

    let response: globalThis.Response;
    try {
      response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
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
