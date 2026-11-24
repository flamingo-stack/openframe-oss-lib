package com.openframe.gateway.config.ws.nats.jetstream;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * The JetStream consumers one websocket session created through this gateway. A consumer's name
 * is the only handle the later API calls ({@code INFO}, {@code DELETE}, {@code MSG.NEXT}) carry,
 * and the subject permissions cannot tell one name from another, so a session may only touch the
 * consumers it created itself. Ordered consumers are recreated on every reconnect, so a new
 * session starting empty costs the clients nothing.
 */
public final class SessionConsumerRegistry {

    private static final String KEY_SEPARATOR = "/";

    private final Set<String> owned = ConcurrentHashMap.newKeySet();

    public void register(String stream, String consumerName) {
        owned.add(keyOf(stream, consumerName));
    }

    public boolean isOwned(String stream, String consumerName) {
        return owned.contains(keyOf(stream, consumerName));
    }

    private static String keyOf(String stream, String consumerName) {
        return stream + KEY_SEPARATOR + consumerName;
    }
}
