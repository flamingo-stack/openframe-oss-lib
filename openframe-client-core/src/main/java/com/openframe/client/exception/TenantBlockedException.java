package com.openframe.client.exception;

/**
 * The machine asking for a token belongs to a blocked tenant. The token endpoint answers it with
 * {@code 403 Forbidden}: the agent pauses its tools and backs off, and picks up again once the
 * tenant is unblocked. Not {@code 410}, which would make the agent uninstall itself.
 */
public class TenantBlockedException extends RuntimeException {

    public TenantBlockedException(String message) {
        super(message);
    }
}
