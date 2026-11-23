package com.openframe.gateway.config.ws;

/**
 * Who a NATS websocket client is, taken from the JWT the gateway accepted on the upgrade: the
 * {@code machine_id} claim makes it a device, otherwise it is the user behind the token.
 */
public record NatsClientIdentity(NatsClientKind kind, String id) {

    public static NatsClientIdentity device(String machineId) {
        return new NatsClientIdentity(NatsClientKind.DEVICE, machineId);
    }

    public static NatsClientIdentity user(String userId) {
        return new NatsClientIdentity(NatsClientKind.USER, userId);
    }
}
