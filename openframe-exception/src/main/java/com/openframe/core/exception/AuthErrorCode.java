package com.openframe.core.exception;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.Arrays;

// The redirect to the auth error page carries one of these names and nothing else; the message is served by query.
// Messages are the product-approved literals the auth flows have always shown; change them only with product.
@Getter
@AllArgsConstructor
public enum AuthErrorCode {
    SSO_LOGIN_FAILED("SSO login failed. Please try again."),
    SSO_SESSION_EXPIRED("SSO session expired. Please try again."),
    SSO_SESSION_INVALID("SSO session is invalid. Please try again."),
    PROVIDER_ACCESS_DENIED("SSO login failed. Please try again."),
    PROVIDER_CONSENT_REQUIRED("SSO login failed. Please try again."),
    PROVIDER_ERROR("SSO login failed. Please try again."),
    EMAIL_NOT_PROVIDED("Email not provided by SSO provider. Please use an account with a verified email."),
    EMAIL_NOT_VERIFIED("This account's email is not verified by the provider. Please try a different sign-in method, or contact your administrator."),
    EMAIL_MISMATCH("This account's email doesn't match the email you entered. Please sign up with the account that matches the form email."),
    ACCOUNT_NOT_FOUND("No account found. Please sign up first."),
    ACCOUNT_INACTIVE("Your account is not active. Please contact your administrator."),
    ACCOUNT_ALREADY_LINKED("This account is already connected to an organization. Please sign in instead."),
    ORGANIZATION_SSO_REQUIRED("Your organization uses its own sign-in for this provider. Enter your email on the login page to be redirected to it."),
    INVITATION_FAILED("Invitation acceptance failed. Please try again."),
    INVITATION_USED("Invitation already used or revoked"),
    INVITATION_EXPIRED("Invitation expired"),
    REGISTRATION_FAILED("Registration failed. Please try again."),
    VERIFICATION_LINK_INVALID("Verification link is invalid or expired. Please request a new one."),
    UNEXPECTED("An unexpected error occurred. Please try again or contact support if the problem persists.");

    private final String message;

    // Never sent by the backend, UNEXPECTED is what a missing, unknown or tampered code resolves to.
    public static AuthErrorCode fromName(String name) {
        return Arrays.stream(values())
                .filter(code -> code.name().equals(name))
                .findFirst()
                .orElse(UNEXPECTED);
    }
}
