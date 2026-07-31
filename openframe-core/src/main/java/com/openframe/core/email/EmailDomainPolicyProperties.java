package com.openframe.core.email;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Tuning for {@link EmailDomainPolicy}. Everything has a working default, so the policy is active
 * out of the box with no configuration.
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "openframe.email-domain-policy")
public class EmailDomainPolicyProperties {

    /** Master switch. When false nothing is blocked — useful for self-hosted deployments. */
    private boolean enabled = true;

    /**
     * Blocked email domains. Defaulted from the bundled
     * {@code config/email-domain-policy-defaults.yml} shipped in this library; override the whole
     * list in a deployment's own config to manage it there.
     */
    private Set<String> blockedDomains = new LinkedHashSet<>();

    /** Domains to allow even if they appear in {@link #blockedDomains} — a per-deployment carve-out. */
    private Set<String> allowedDomains = new LinkedHashSet<>();

    /** Secondary lookup against an external disposable-domain API. */
    private DisposableCheck disposableCheck = new DisposableCheck();

    @Getter
    @Setter
    public static class DisposableCheck {

        private boolean enabled = true;

        /** Domain is appended to this base, e.g. {@code .../v1/disposable/example.com}. */
        private String url = "https://open.kickbox.com/v1/disposable/";

        /**
         * Hard ceiling on the whole call. Kept short on purpose: this runs inline in registration
         * and invitation, and a slow third party must not stall either.
         */
        private long timeoutMs = 1500;
    }
}
