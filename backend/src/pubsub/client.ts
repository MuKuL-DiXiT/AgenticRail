import Redis from 'ioredis';
import { env } from '../config/env';

// We need separate clients for publish and subscribe because
// once a client enters subscriber mode, it cannot publish.
let pubClient: Redis | null = null;
let subClient: Redis | null = null;

export function getPubClient(): Redis {
  if (!pubClient) {
    pubClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }
  return pubClient;
}

export function getSubClient(): Redis {
  if (!subClient) {
    subClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }
  return subClient;
}

export async function connectRedis() {
  await Promise.all([getPubClient().connect(), getSubClient().connect()]);
}

export async function closeRedis() {
  if (pubClient) {
    await pubClient.quit();
    pubClient = null;
  }
  if (subClient) {
    await subClient.quit();
    subClient = null;
  }
}

/**
 * Publishes a typed message to a channel.
 */
export async function publishMessage(channel: string, message: any): Promise<void> {
  const client = getPubClient();
  await client.publish(channel, JSON.stringify(message));
}
