package com.openframe.core.email;

import lombok.experimental.UtilityClass;

import java.util.Locale;
import java.util.Set;

// One form per mailbox, so a single block catches every spelling of the same address.
@UtilityClass
public class EmailAddressCanonicalizer {

    private static final Set<String> DOTLESS_MAILBOX_DOMAINS = Set.of("gmail.com", "googlemail.com");
    private static final String DOTLESS_MAILBOX_DOMAIN = "gmail.com";
    private static final char AT = '@';
    private static final char TAG_SEPARATOR = '+';
    private static final String DOT = ".";
    private static final String EMPTY = "";
    private static final int NOT_FOUND = -1;

    public static String canonicalAddress(String email) {
        if (!hasLocalPartAndDomain(email)) {
            throw new IllegalArgumentException("Not an email address: it needs a local part and a domain");
        }
        String lowercased = lowercaseTrimmed(email);
        int at = lowercased.lastIndexOf(AT);
        String localPart = lowercased.substring(0, at);
        String local = withoutTag(localPart);
        String domain = lowercased.substring(at + 1);
        if (isDotlessMailboxDomain(domain)) {
            return withoutDots(local) + AT + DOTLESS_MAILBOX_DOMAIN;
        }
        return local + AT + domain;
    }

    public static String domainOf(String email) {
        if (!hasDomain(email)) {
            throw new IllegalArgumentException("Not an email address: it has no domain");
        }
        String domainPart = domainPartOf(email);
        return canonicalDomain(domainPart);
    }

    public static String canonicalDomain(String domain) {
        if (domain == null) {
            return null;
        }
        String canonical = lowercaseTrimmed(domain);
        if (canonical.isEmpty()) {
            return null;
        }
        return canonical;
    }

    static boolean hasDomain(String email) {
        if (email == null) {
            return false;
        }
        String domainPart = domainPartOf(email);
        return canonicalDomain(domainPart) != null;
    }

    static boolean hasLocalPartAndDomain(String email) {
        if (email == null) {
            return false;
        }
        String lowercased = lowercaseTrimmed(email);
        int at = lowercased.lastIndexOf(AT);
        return isBetweenLocalPartAndDomain(at, lowercased);
    }

    private static boolean isBetweenLocalPartAndDomain(int at, String address) {
        return at > 0 && at < address.length() - 1;
    }

    private static String domainPartOf(String email) {
        int at = email.lastIndexOf(AT);
        if (at == NOT_FOUND) {
            return EMPTY;
        }
        return email.substring(at + 1);
    }

    private static String withoutTag(String local) {
        int tag = local.indexOf(TAG_SEPARATOR);
        if (tag > 0) {
            return local.substring(0, tag);
        }
        return local;
    }

    // A local part made only of dots stays as written: dropping them would leave no mailbox.
    private static String withoutDots(String local) {
        String dotless = local.replace(DOT, EMPTY);
        if (dotless.isEmpty()) {
            return local;
        }
        return dotless;
    }

    private static boolean isDotlessMailboxDomain(String domain) {
        return DOTLESS_MAILBOX_DOMAINS.contains(domain);
    }

    private static String lowercaseTrimmed(String value) {
        String trimmed = value.trim();
        return trimmed.toLowerCase(Locale.ROOT);
    }
}
