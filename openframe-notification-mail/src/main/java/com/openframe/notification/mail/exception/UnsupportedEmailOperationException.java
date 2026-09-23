package com.openframe.notification.mail.exception;

/**
 * Thrown when an email provider is asked to perform an operation it does not
 * support (e.g. requesting email verification from the SMTP provider when
 * only the HubSpot provider implements it). This is a domain-specific
 * unchecked exception distinct from {@link UnsupportedOperationException} so
 * callers/handlers can distinguish provider-capability failures from
 * programming bugs.
 */
public class UnsupportedEmailOperationException extends RuntimeException {

    public UnsupportedEmailOperationException(String message) {
        super(message);
    }
}
