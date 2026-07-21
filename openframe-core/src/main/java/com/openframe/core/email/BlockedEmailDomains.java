package com.openframe.core.email;

import java.util.Set;

/**
 * Built-in email domains that may not be used to register, be invited, or be configured for SSO
 * auto-provisioning.
 * <p>
 * Two groups, blocked for different reasons: privacy-focused providers, whose accounts cannot be
 * traced back to an organisation, and disposable/temporary services. Note that the external
 * disposable-domain API does NOT flag the privacy-focused group — it reports them as legitimate —
 * so this list is not redundant with {@link DisposableDomainChecker}; the two cover different sets.
 */
public final class BlockedEmailDomains {

    private BlockedEmailDomains() {
    }

    public static final Set<String> PRIVACY_FOCUSED = Set.of(
            "proton.me",
            "protonmail.com",
            "pm.me",
            "tuta.com",
            "tutanota.com",
            "tutanota.de",
            "tuta.io",
            "mailbox.org",
            "posteo.de",
            "hey.com",
            "startmail.com",
            "fastmail.com",
            "runbox.com",
            "countermail.com",
            "disroot.org"
    );

    public static final Set<String> DISPOSABLE = Set.of(
            "guerrillamail.com",
            "guerrillamail.net",
            "guerrillamail.org",
            "guerrillamail.biz",
            "sharklasers.com",
            "10minutemail.com",
            "10minutemail.net",
            "temp-mail.org",
            "tempmail.com",
            "tempmail.net",
            "tempr.email",
            "tempmailo.com",
            "throwawaymail.com",
            "throwaway.email",
            "yopmail.com",
            "yopmail.net",
            "yopmail.fr",
            "getnada.com",
            "nada.email",
            "maildrop.cc",
            "trashmail.com",
            "trashmail.net",
            "trashmail.de",
            "dispostable.com",
            "mohmal.com",
            "fakeinbox.com",
            "fakemail.net",
            "mailnesia.com",
            "mailcatch.com",
            "mintemail.com",
            "mailnull.com",
            "spamgourmet.com",
            "spam4.me",
            "mytemp.email",
            "emailondeck.com",
            "mailtemp.net",
            "tempinbox.com",
            "33mail.com",
            "inboxbear.com",
            "tempail.com",
            "mail-temp.com",
            "burnermail.io",
            "minuteinbox.com",
            "easytrashmail.com",
            "discard.email",
            "discardmail.com",
            "mailexpire.com",
            "jetable.org",
            "spambox.us",
            "tempmailaddress.com",
            "moakt.com",
            "luxusmail.org",
            "harakirimail.com",
            "anonbox.net",
            "mailsac.com",
            "inboxkitten.com"
    );

    /** Everything blocked by default. */
    public static final Set<String> DEFAULT = concat(PRIVACY_FOCUSED, DISPOSABLE);

    private static Set<String> concat(Set<String> a, Set<String> b) {
        return java.util.stream.Stream.concat(a.stream(), b.stream())
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }
}
