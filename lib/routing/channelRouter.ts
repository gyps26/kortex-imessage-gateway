import { connectToDatabase } from '../db/mongoose';
import { Message, IMessage } from '../../models/Message';
import { Profile } from '../../models/Profile';
import { GhlLocation } from '../../models/GhlLocation';
import { outboundQueue } from '../queue/redis';
import { findAvailableConnector, assignConnectorToMessage } from '../connectors/assign';
import { Channel, CHANNEL_PRIORITY, OutboundPayload } from '../connectors/types';
import { dispatchSmsOutbound } from '../sms/fcm';

const OUTBOUND_JOB_NAME = 'send-outbound';

async function resolveChannel(payload: OutboundPayload): Promise<Channel> {
  if (payload.channel) {
    return payload.channel;
  }

  await connectToDatabase();

  const location = await GhlLocation.findOne({ locationId: payload.locationId });
  if (location?.defaultChannel) {
    const connector = await findAvailableConnector(payload.locationId, location.defaultChannel);
    if (connector) return location.defaultChannel;
  }

  for (const channel of CHANNEL_PRIORITY) {
    const connector = await findAvailableConnector(payload.locationId, channel);
    if (connector) return channel;
  }

  return 'IMESSAGE';
}

async function dispatchToChannel(message: IMessage, channel: Channel): Promise<IMessage> {
  const connector = await findAvailableConnector(message.locationId!, channel);

  if (!connector) {
    console.warn(`No active ${channel} connector for location ${message.locationId}`);
    throw new Error(`No available ${channel} connector`);
  }

  const { workerId } = await assignConnectorToMessage(connector);
  message.channel = channel;
  message.workerId = workerId;
  message.deviceId = workerId;

  if (channel === 'IMESSAGE') {
    message.status = 'queued';
    await message.save();
    return message;
  }

  if (channel === 'WHATSAPP') {
    message.status = 'queued';
    await message.save();
    const { whatsappOutboundQueue } = await import('../queue/redis');
    if (whatsappOutboundQueue) {
      await whatsappOutboundQueue.add(
        'dispatch-whatsapp',
        { messageId: message._id.toString() },
        { removeOnComplete: true, attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
      );
    }
    return message;
  }

  if (channel === 'SMS') {
    message.status = 'pending';
    await message.save();
    await dispatchSmsOutbound(message, connector);
    return message;
  }

  await message.save();
  return message;
}

export async function createOutboundMessage(payload: OutboundPayload): Promise<IMessage> {
  await connectToDatabase();

  const channel = await resolveChannel(payload);

  const message = await Message.create({
    ghlContactId: payload.contactId,
    ghlMessageId: payload.ghlMessageId,
    locationId: payload.locationId,
    phone: payload.phone,
    body: payload.body,
    attachments: payload.attachments || [],
    direction: 'outbound',
    status: 'pending',
    channel,
  });

  if (outboundQueue) {
    await outboundQueue.add(
      OUTBOUND_JOB_NAME,
      { messageId: message._id.toString() },
      {
        removeOnComplete: true,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      }
    );
    return message;
  }

  await dispatchToChannel(message, channel);
  return message;
}

export async function processOutboundJob(messageId: string): Promise<IMessage | null> {
  await connectToDatabase();

  const message = await Message.findById(messageId);
  if (!message) return null;

  const channel = message.channel || (await resolveChannel({
    phone: message.phone,
    body: message.body,
    locationId: message.locationId!,
  }));

  if (!message.channel) {
    message.channel = channel;
    await message.save();
  }

  return dispatchToChannel(message, channel);
}

export { OUTBOUND_JOB_NAME };
