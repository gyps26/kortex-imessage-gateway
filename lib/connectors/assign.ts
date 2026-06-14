import { Profile, IProfile } from '../../models/Profile';
import { Channel } from './types';

function resetDailyCountIfNeeded(profile: IProfile): void {
  const now = new Date();
  const lastReset = profile.lastReset || new Date(0);
  if (
    now.getDate() !== lastReset.getDate() ||
    now.getMonth() !== lastReset.getMonth() ||
    now.getFullYear() !== lastReset.getFullYear()
  ) {
    profile.dailyCount = 0;
    profile.lastReset = now;
  }
}

export async function findAvailableConnector(
  locationId: string,
  channel: Channel
): Promise<IProfile | null> {
  const activeProfiles = await Profile.find({
    status: 'active',
    channel,
    assignedLocationId: locationId,
  }).sort({ lastPing: -1 });

  for (const profile of activeProfiles) {
    resetDailyCountIfNeeded(profile);
    await profile.save();

    if (profile.dailyCount < (profile.dailyLimit || 50)) {
      return profile;
    }
  }

  return null;
}

export async function assignConnectorToMessage(
  profile: IProfile
): Promise<{ connectorId: string; workerId: string }> {
  profile.dailyCount += 1;
  await profile.save();
  return { connectorId: profile.workerId, workerId: profile.workerId };
}
