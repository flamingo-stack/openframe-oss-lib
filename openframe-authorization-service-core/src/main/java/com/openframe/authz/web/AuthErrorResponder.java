package com.openframe.authz.web;

import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.authz.service.auth.AuthErrorDetailStore;
import com.openframe.core.exception.AuthErrorCode;
import com.openframe.core.exception.AuthFlowException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.stereotype.Component;

import java.io.IOException;

import static com.openframe.core.exception.AuthErrorCode.PROVIDER_ACCESS_DENIED;
import static com.openframe.core.exception.AuthErrorCode.PROVIDER_CONSENT_REQUIRED;
import static com.openframe.core.exception.AuthErrorCode.PROVIDER_ERROR;
import static com.openframe.core.exception.AuthErrorCode.SSO_SESSION_EXPIRED;
import static org.springframework.util.StringUtils.hasText;

/**
 * Single exit point for auth failures that end in a redirect to the error page.
 * <p>
 * The redirect carries one reference: the {@link AuthErrorCode} name, or, when the failure has a dynamic
 * part worth showing (a message built around an email), the short-lived key that text was stored under. The
 * page resolves either through one query. Only text this code composed is ever stored: the provider's
 * {@code error_description} arrives as query parameters on our own callback, so anyone with a login in
 * progress can put any sentence there, and it is logged, never shown. The classification exists only for
 * the log line, so provider-side failures can be counted and grouped.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AuthErrorResponder {

    private static final String ACCESS_DENIED = "access_denied";
    private static final String AUTHORIZATION_REQUEST_NOT_FOUND = "authorization_request_not_found";
    private static final String INVALID_STATE_PARAMETER = "invalid_state_parameter";

    private final AuthErrorDetailStore detailStore;

    @Value("${openframe.auth.error-url}")
    private String authErrorUrl;

    public void send(HttpServletResponse response, HttpServletRequest request, String event, Exception e,
                     AuthErrorCode fallbackCode) throws IOException {
        AuthErrorCode code = resolveCode(e, fallbackCode);
        log.error("Auth failure [{}] event={} code={} tenantId={} uri={} detail={}",
                classify(e), event, code, TenantContext.getTenantId(),
                request != null ? request.getRequestURI() : null, e.getMessage(), e);

        String reference = reference(code, e);
        String target = authErrorUrl + "?ref=" + reference;
        response.sendRedirect(target);
    }

    private AuthErrorCode resolveCode(Exception e, AuthErrorCode fallbackCode) {
        if (e instanceof AuthFlowException flowException) {
            return flowException.getCode();
        }
        if (e instanceof OAuth2AuthenticationException oauthException) {
            return providerCode(oauthException);
        }
        return fallbackCode;
    }

    // The stored key when there is a dynamic message, else the code name itself.
    private String reference(AuthErrorCode code, Exception e) {
        String detail = resolveDetail(e);
        if (!hasText(detail)) {
            return code.name();
        }
        try {
            return detailStore.save(code, detail);
        } catch (RuntimeException storeFailure) {
            log.warn("Auth error detail not stored, redirecting with code {} only", code, storeFailure);
            return code.name();
        }
    }

    private String resolveDetail(Exception e) {
        if (e instanceof AuthFlowException flowException) {
            return flowException.getDetail();
        }
        return "";
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
        return switch (providerCode(e)) {
            case PROVIDER_ACCESS_DENIED -> "PROVIDER_CANCELLED";
            case PROVIDER_CONSENT_REQUIRED -> "PROVIDER_CONSENT";
            default -> "PROVIDER_ERROR";
        };
    }

    private AuthErrorCode providerCode(OAuth2AuthenticationException e) {
        OAuth2Error error = e.getError();
        String code = errorCodeOf(error);
        if (ACCESS_DENIED.equals(code)) {
            return PROVIDER_ACCESS_DENIED;
        }
        if (isLostAuthorizationRequest(code)) {
            return SSO_SESSION_EXPIRED;
        }
        if (isConsentFailure(descriptionOf(error))) {
            return PROVIDER_CONSENT_REQUIRED;
        }
        return PROVIDER_ERROR;
    }

    // Spring raises these when the saved authorization request is gone by the time the provider calls
    // back: the session was lost or the callback replayed, which to the user is an expired sign-in.
    private static boolean isLostAuthorizationRequest(String code) {
        return AUTHORIZATION_REQUEST_NOT_FOUND.equals(code) || INVALID_STATE_PARAMETER.equals(code);
    }

    private static String errorCodeOf(OAuth2Error error) {
        return error != null && error.getErrorCode() != null ? error.getErrorCode() : "";
    }

    private static String descriptionOf(OAuth2Error error) {
        return error != null && error.getDescription() != null ? error.getDescription() : "";
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
