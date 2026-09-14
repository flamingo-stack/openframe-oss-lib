package com.openframe.authz.service.sso;

/**
 * Thrown when a signup ticket cannot be found or has expired in Redis, indicating the
 * pending signup session is no longer valid and the user must restart the flow.
 */
public class SignupTicketExpiredException extends RuntimeException {

    public SignupTicketExpiredException(String message) {
        super(message);
    }
}
