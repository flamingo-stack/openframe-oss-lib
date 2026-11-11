package com.openframe.core.email;

import lombok.experimental.UtilityClass;

import java.util.Locale;
import java.util.Set;

// One form per mailbox (lowercase, no +tag, Gmail without dots), so one block catches every spelling of it.
@UtilityClass
public class EmailAddressCanonicalizer {

    private static final String GMAIL = "gmail.com";
    private static final Set<String> GMAIL_DOMAINS = Set.of(GMAIL, "googlemail.com");

    public static boolean isAddress(String email) {
        if (email == null) {
            return false;
        }
        String trimmed = email.trim();
        int at = trimmed.lastIndexOf('@');
        return at > 0 && at < trimmed.length() - 1;
    }

    /** @throws IllegalArgumentException when the input is not {@code local@domain} */
    public static String canonicalAddress(String email) {
        if (!isAddress(email)) {
            throw new IllegalArgumentException("Not an email address: it needs a local part and a domain");
        }
        String address = email.trim().toLowerCase(Locale.ROOT);
        int at = address.lastIndexOf('@');
        String localPart = address.substring(0, at);
        String local = withoutTag(localPart);
        String domain = address.substring(at + 1);
        if (GMAIL_DOMAINS.contains(domain)) {
            return withoutDots(local) + '@' + GMAIL;
        }
        return local + '@' + domain;
    }

    /** The canonical domain of an address; {@code null} when it has none. */
    public static String domainOf(String email) {
        int at = email == null ? -1 : email.lastIndexOf('@');
        if (at < 0) {
            return null;
        }
        String domainPart = email.substring(at + 1);
        return canonicalDomain(domainPart);
    }

    /** Trimmed and lowercase; {@code null} for blank input. */
    public static String canonicalDomain(String domain) {
        if (domain == null || domain.isBlank()) {
            return null;
        }
        return domain.trim().toLowerCase(Locale.ROOT);
    }

    private static String withoutTag(String local) {
        int tag = local.indexOf('+');
        return tag > 0 ? local.substring(0, tag) : local;
    }

    // A local part of dots only stays as written: dropping them would leave no mailbox.
    private static String withoutDots(String local) {
        String dotless = local.replace(".", "");
        return dotless.isEmpty() ? local : dotless;
    }
}
