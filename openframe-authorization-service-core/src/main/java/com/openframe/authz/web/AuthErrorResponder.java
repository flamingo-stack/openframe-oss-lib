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
import static org.springframework.util.StringUtils.hasText;

/**
 * Single exit point for auth failures that end in a redirect to the error page.
 * <p>
 * The failure message is shown to the user as-is, including the identity provider's own
 * {@code error_description}. The classification exists only for the log line, so provider-side
 * failures can be counted and grouped without changing what the user sees.
 */
@Slf4j
@Component
public class AuthErrorResponder {

    @Value("${openframe.auth.error-url}")
    private String authErrorUrl;

    public void send(HttpServletResponse response, HttpServletRequest request, String event, Exception e,
                     String fallbackMessage) throws IOException {
        log.error("Auth failure [{}] event={} tenantId={} uri={} detail={}",
                classify(e), event, TenantContext.getTenantId(),
                request != null ? request.getRequestURI() : null, e.getMessage(), e);

        String message = hasText(e.getMessage()) ? e.getMessage() : fallbackMessage;
        response.sendRedirect(authErrorUrl + "?error=" + URLEncoder.encode(message, UTF_8));
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
