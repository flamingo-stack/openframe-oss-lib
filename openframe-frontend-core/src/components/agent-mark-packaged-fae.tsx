'use client';

import { FAE_AVATAR_DATA_URI } from '../assets/fae-avatar';

/**
 * Fae's avatar as packaged with the library: an embedded picture (50 KB of
 * source). Its own module so `AgentMark` fetches it only when it draws it, which
 * a host that provides the agents' identities never does.
 */
export default function PackagedFaeAvatar({ className }: { className?: string }) {
  return <img src={FAE_AVATAR_DATA_URI} alt="" className={className} />;
}
