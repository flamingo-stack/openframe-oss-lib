package com.openframe.core.email;

/**
 * A list of blocked email domains kept outside the configuration, for example in a database a backoffice
 * edits. {@link EmailDomainPolicy} asks every source bean after the configured list and before the external
 * disposable check, so a domain added through a source is blocked without a deploy.
 * <p>
 * Implementations MUST fail open: a source that cannot answer returns {@code false}, so a datastore
 * problem never stops someone registering or being invited.
 */
public interface BlockedEmailDomainSource {

    /**
     * @param domain lowercase domain, trimmed, without the local part
     * @return {@code true} only when the domain is positively known to be blocked
     */
    boolean isBlocked(String domain);
}
