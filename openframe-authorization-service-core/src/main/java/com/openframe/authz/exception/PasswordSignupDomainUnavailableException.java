package com.openframe.authz.exception;

/** The requested password-signup domain cannot be used for a new workspace. */
public class PasswordSignupDomainUnavailableException extends RuntimeException {

    public PasswordSignupDomainUnavailableException() {
        super("This domain is already in use. Please try a different one.");
    }
}
