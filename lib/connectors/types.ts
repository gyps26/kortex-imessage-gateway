export type Channel = 'IMESSAGE' | 'WHATSAPP' | 'SMS';

export const CHANNEL_PRIORITY: Channel[] = ['WHATSAPP', 'SMS', 'IMESSAGE'];

export interface OutboundPayload {
  phone: string;
  body: string;
  locationId: string;
  contactId?: string;
  ghlMessageId?: string;
  attachments?: string[];
  channel?: Channel;
}
