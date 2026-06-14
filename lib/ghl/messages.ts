import axios from 'axios';
import { GhlLocation } from '../../models/GhlLocation';
import { getValidAccessToken } from '../ghl';

export async function injectInbound(params: {
  locationId: string;
  phone: string;
  message: string;
  conversationProviderId?: string;
  direction?: 'outbound';
}): Promise<void> {
  const ghlLocation = await GhlLocation.findOne({ locationId: params.locationId });
  const accessToken = ghlLocation ? await getValidAccessToken(ghlLocation) : null;
  if (!accessToken) return;

  const payload: Record<string, string> = {
    type: 'SMS',
    phone: params.phone,
    message: params.message,
    conversationProviderId: params.conversationProviderId || params.locationId,
  };

  if (params.direction === 'outbound') {
    payload.direction = 'outbound';
  }

  try {
    await axios.post('https://services.leadconnectorhq.com/conversations/messages/inbound', payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Version: '2021-04-15',
        'Content-Type': 'application/json',
      },
    });
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number } };
    if (params.direction === 'outbound' && axiosErr.response?.status === 400) {
      delete payload.direction;
      await axios.post('https://services.leadconnectorhq.com/conversations/messages/inbound', payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Version: '2021-04-15',
          'Content-Type': 'application/json',
        },
      });
      return;
    }
    throw err;
  }
}

export async function updateMessageStatus(params: {
  locationId: string;
  ghlMessageId: string;
  status: 'sent' | 'delivered' | 'failed';
  errorDetails?: string;
}): Promise<void> {
  const ghlLocation = await GhlLocation.findOne({ locationId: params.locationId });
  const accessToken = ghlLocation ? await getValidAccessToken(ghlLocation) : null;
  if (!accessToken) return;

  await axios.put(
    `https://services.leadconnectorhq.com/conversations/messages/${params.ghlMessageId}/status`,
    {
      status: params.status === 'failed' ? 'undelivered' : 'delivered',
      error: params.errorDetails ? { code: 400, message: params.errorDetails } : undefined,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Version: '2021-04-15',
        'Content-Type': 'application/json',
      },
    }
  );
}

export async function tagNonIMessage(locationId: string, contactId: string): Promise<void> {
  const ghlLocation = await GhlLocation.findOne({ locationId });
  const accessToken = ghlLocation ? await getValidAccessToken(ghlLocation) : null;
  if (!accessToken) return;

  await axios.post(
    `https://services.leadconnectorhq.com/contacts/${contactId}/tags`,
    { tags: ['Non-iPhone'] },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Version: '2021-07-28',
        'Content-Type': 'application/json',
      },
    }
  );
}
