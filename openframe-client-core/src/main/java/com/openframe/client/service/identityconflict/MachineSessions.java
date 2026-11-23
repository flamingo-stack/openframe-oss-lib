package com.openframe.client.service.identityconflict;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

final class MachineSessions {

    private record Seen(Instant first, Instant last) {
    }

    private final Duration ttl;
    private final Map<String, Seen> sessions = new HashMap<>();
    private String latest;

    MachineSessions(Duration ttl) {
        this.ttl = ttl;
    }

    Optional<String> heartbeat(String sessionId, Instant now) {
        prune(now);
        String previous = latest;
        Seen seen = sessions.get(sessionId);
        boolean returnedAfterAnother = seen != null && previous != null && !previous.equals(sessionId)
                && sessions.containsKey(previous);
        Instant first = seen == null ? now : seen.first();
        sessions.put(sessionId, new Seen(first, now));
        latest = sessionId;
        if (!returnedAfterAnother) {
            return Optional.empty();
        }
        return Optional.of(newerOf(sessionId, previous));
    }

    boolean prune(Instant now) {
        sessions.values().removeIf(seen -> seen.last().plus(ttl).isBefore(now));
        if (latest != null && !sessions.containsKey(latest)) {
            latest = null;
        }
        return sessions.isEmpty();
    }

    private String newerOf(String a, String b) {
        Instant firstA = sessions.get(a).first();
        Instant firstB = sessions.get(b).first();
        return firstA.isAfter(firstB) ? a : b;
    }
}
