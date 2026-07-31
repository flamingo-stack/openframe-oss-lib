package com.openframe.core.email;

/**
 * Secondary lookup for domains that are not in the built-in blocklist.
 * <p>
 * Implementations MUST fail open: if the answer cannot be obtained — service down, timeout, bad
 * response — return {@code false}. A third party being unreachable must never stop someone
 * registering or being invited.
 */
public interface DisposableDomainChecker {

    /**
     * @param domain lowercase domain, without the local part
     * @return {@code true} only when the domain is positively known to be disposable
     */
    boolean isDisposable(String domain);
}
