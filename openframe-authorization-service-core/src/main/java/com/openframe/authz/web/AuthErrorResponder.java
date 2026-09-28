package com.openframe.authz.web;

import com.openframe.authz.config.tenant.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;

import static java.nio.charset.StandardCharsets.UTF_8;

/**
 * Single exit point for auth failures that end in a redirect to the error page.
 * <p>
 * The failure message shown to the user is a fixed, localized string chosen from the
 * classification of the failure. Raw provider-supplied text (e.g. the identity provider's own
 * {@code error_description}) is never echoed back to the user; it is only ever logged, so
 * provider-side failures can be counted and grouped without exposing untrusted third-party
 * content on our own error page.
 */
@Slf4j
@Component
public class AuthErrorResponder {

    @Value("${openframe.auth.error-url}")
    private String authErrorUrl;

    public void send(HttpServletResponse response, HttpServletRequest request, String event, Exception e,
                     String fallbackMessage) throws IOException {
        String classification = classify(e);
        log.error("Auth failure [{}] event={} tenantId={} uri={} detail={}",
                classification, event, TenantContext.getTenantId(),
                request != null ? request.getRequestURI() : null, e.getMessage(), e);

        String message = userFacingMessage(classification, fallbackMessage);
        response.sendRedirect(authErrorUrl + "?error=" + URLEncoder.encode(message, UTF_8));
    }

    private String userFacingMessage(String classification, String fallbackMessage) {
        return switch (classification) {
            case "PROVIDER_CANCELLED" -> "Sign-in was cancelled.";
            case "PROVIDER_CONSENT" -> "The identity provider could not complete consent for this application.";
            case "PROVIDER_ERROR" -> "The identity provider returned an error during sign-in.";
            case "USER_INPUT" -> fallbackMessage;
            default -> fallbackMessage;
        };
    }

    private String classify(Exception e) {
        if (e instanceof IllegalArgumentException || e instanceof IllegalStateException) {
            return "USER_INPUT";
        }
        if (e instanceof OAuth2AuthenticationException oauthException) {
            return classifyProvider(oauthException);
        }
        return "UNEXPECTED";
    }

    private String classifyProvider(OAuth2AuthenticationException e) {
        OAuth2Error error = e.getError();
        String code = error != null ? error.getErrorCode() : null;
        String description = error != null && error.getDescription() != null ? error.getDescription() : "";

        if ("access_denied".equals(code)) {
            return "PROVIDER_CANCELLED";
        }
        if (isConsentFailure(description)) {
            return "PROVIDER_CONSENT";
        }
        return "PROVIDER_ERROR";
    }

    /**
     * Entra refuses the consent grant when the application cannot be provisioned into the caller's
     * directory — typically a leftover or soft-deleted service principal for our app. Matched on the
     * description text rather than an AADSTS number, since the same condition surfaces under several.
     */
    private boolean isConsentFailure(String description) {
        return description.contains("Consent action for Application")
                || description.contains("service principal name is already present")
                || description.contains("AADSTS650056")
                || description.contains("AADSTS700016");
    }
}
