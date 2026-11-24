package com.openframe.gateway.config.ws.nats;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Value;

import java.util.regex.Pattern;

/**
 * Who a NATS websocket client is, taken from the JWT the gateway accepted on the upgrade: an
 * {@code AGENT} token names its machine, an {@code ADMIN} token its user. The id becomes one
 * token of every subject pattern, so it has to be exactly one literal token: an id with a dot
 * would fragment the pattern, one with a wildcard would widen it to other clients.
 */
@Value
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class NatsClientIdentity {

    private static final Pattern SINGLE_LITERAL_TOKEN = Pattern.compile("[^\\s.*>]+");

    NatsClientKind kind;
    String id;

    public static NatsClientIdentity device(String machineId) {
        return new NatsClientIdentity(NatsClientKind.DEVICE, requireLiteralToken(machineId, "machine id"));
    }

    public static NatsClientIdentity user(String userId) {
        return new NatsClientIdentity(NatsClientKind.USER, requireLiteralToken(userId, "user id"));
    }

    private static String requireLiteralToken(String id, String what) {
        if (id == null || !SINGLE_LITERAL_TOKEN.matcher(id).matches()) {
            throw new IllegalStateException("The " + what + " is not a single literal NATS token: " + id);
        }
        return id;
    }
}
