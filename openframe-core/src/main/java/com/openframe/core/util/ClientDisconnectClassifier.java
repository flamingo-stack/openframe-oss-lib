package com.openframe.core.util;

import reactor.core.Exceptions;
import reactor.netty.channel.AbortedException;
import reactor.netty.http.client.PrematureCloseException;

import java.io.IOException;
import java.nio.channels.ClosedChannelException;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Locale;
import java.util.Set;

/**
 * Classifies throwables that indicate the remote peer closed the connection
 * (client navigated away, agent reconnected, LB timed out an idle stream)
 * as opposed to genuine server-side faults.
 * <p>
 * Netty's platform-specific {@code Errors$NativeIoException} ("Broken pipe",
 * "Connection reset by peer") is matched through the {@link IOException}
 * message branch because the class lives in a platform-classifier jar.
 * {@code StacklessClosedChannelException} is covered by the
 * {@link ClosedChannelException} check.
 */
public final class ClientDisconnectClassifier {

    private ClientDisconnectClassifier() {
    }

    public static boolean isClientDisconnect(Throwable error) {
        if (error == null) {
            return false;
        }
        Set<Throwable> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        for (Throwable t = Exceptions.unwrap(error); t != null && seen.add(t); t = t.getCause()) {
            if (isDisconnect(t)) {
                return true;
            }
        }
        return false;
    }

    private static boolean isDisconnect(Throwable t) {
        return switch (t) {
            case AbortedException aborted -> true;
            case ClosedChannelException closed -> true;
            case PrematureCloseException premature -> true;
            case IOException io -> hasDisconnectMessage(io.getMessage());
            default -> false;
        };
    }

    private static boolean hasDisconnectMessage(String message) {
        if (message == null) {
            return false;
        }
        String m = message.toLowerCase(Locale.ROOT);
        return m.contains("broken pipe")
                || m.contains("connection reset")
                || m.contains("prematurely closed")
                || m.contains("connection has been closed");
    }
}
