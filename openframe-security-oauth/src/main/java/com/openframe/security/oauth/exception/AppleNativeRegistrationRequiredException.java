package com.openframe.security.oauth.exception;

/**
 * The verified Apple identity has no account yet — the app should take the user into
 * registration instead of treating this as a failed sign-in.
 */
public class AppleNativeRegistrationRequiredException extends RuntimeException {
    public AppleNativeRegistrationRequiredException() {
        super("registration_required");
    }
}
