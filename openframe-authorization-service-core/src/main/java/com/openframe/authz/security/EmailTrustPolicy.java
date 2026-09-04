package com.openframe.authz.security;

import com.openframe.authz.util.OidcUserUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Map;

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
@Slf4j
@Component
public class EmailTrustPolicy {

    private static final String MICROSOFT = "microsoft";

    /**
     * Directory id Microsoft issues ALL personal-account tokens under, published in the identity
     * platform's token-claims reference. Configurable for test stubs; the default is the value.
     */
    @Value("${openframe.sso.microsoft.personal-accounts-tenant-id:9188040d-6c67-4c5b-b112-36a304b66dad}")
    private String personalAccountsTenantId;

    public boolean emailTrustedForRouting(String provider, Map<String, Object> claims) {
        if (MICROSOFT.equals(provider)) {
            if (personalAccountsTenantId.equals(claims.get("tid"))) {
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
