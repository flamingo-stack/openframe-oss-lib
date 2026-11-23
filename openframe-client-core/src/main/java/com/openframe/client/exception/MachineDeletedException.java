package com.openframe.client.exception;

/**
 * The machine asking for a token was deleted. The token endpoint answers it with {@code 410 Gone}, the
 * status the agent already treats as final: after a few in a row it stops its tools, backs off, and
 * uninstalls itself.
 */
public class MachineDeletedException extends RuntimeException {

    public MachineDeletedException(String message) {
        super(message);
    }
}
