package com.openframe.authz.security;

import com.openframe.authz.config.oidc.MicrosoftSSOProperties;
import com.openframe.authz.util.OidcUserUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;

import static com.openframe.authz.config.oidc.MicrosoftSSOProperties.MICROSOFT;

/**
 * Whether a provider-asserted email is trustworthy enough to ROUTE INTO AN EXISTING ACCOUNT.
 * Google and Apple verify mailbox/domain ownership before an email appears in a token. A generic
 * multi-tenant Microsoft app does not: the email attribute is free text set by the issuing
 * directory's admin, and anyone can create a directory (the nOAuth account-takeover class) — so
 * Microsoft org tokens additionally require the positive domain-ownership signal {@code xms_edov}.
 * Personal Microsoft accounts are recognized by the consumer directory's well-known tenant id:
 * their emails are Microsoft-verified sign-in aliases with no directory admin who could forge
 * them, so they are trusted without {@code xms_edov} (which is never issued on MSA tokens).
 */
@Component
@RequiredArgsConstructor
public class EmailTrustPolicy {

    private final MicrosoftSSOProperties microsoftProps;

    public boolean emailTrustedForRouting(String provider, Map<String, Object> claims) {
        if (MICROSOFT.equals(provider)) {
            if (microsoftProps.getPersonalAccountsTenantId().equals(claims.get("tid"))) {
                return true;
            }
            Object edov = claims.get("xms_edov");
            return Boolean.TRUE.equals(edov)
                    || "true".equalsIgnoreCase(OidcUserUtils.stringClaim(edov))
                    || Boolean.TRUE.equals(claims.get("email_verified"));
        }
        return OidcUserUtils.emailVerifiedClaimAllows(claims);
    }
}
