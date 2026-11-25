package com.openframe.data.document.tenant;

import java.security.SecureRandom;
import java.util.regex.Pattern;

/**
 * The public reference of a tenant: {@code T-} and eight random Crockford base32 characters, e.g. {@code T-7KQ2M9XA}.
 * <p>
 * It names a tenant where the real id and domain must not appear (the backoffice's masked view, screenshots, chat).
 * It is random rather than derived from the id, so it cannot be turned back into the id, and not sequential, so it
 * says nothing about how many tenants there are. 32^8 values keep a collision unlikely; the unique index on
 * {@link Tenant#getDisplayId()} still guards it.
 */
public final class TenantDisplayId {

    public static final String PREFIX = "T-";

    private static final int LENGTH = 8;

    /** Crockford base32: no I, L, O or U, so a reference read aloud or retyped is not mistaken. */
    private static final char[] ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ".toCharArray();

    private static final Pattern FORMAT = Pattern.compile("T-[0-9A-HJKMNP-TV-Z]{8}");

    private static final SecureRandom RANDOM = new SecureRandom();

    private TenantDisplayId() {
    }

    public static String generate() {
        StringBuilder id = new StringBuilder(PREFIX.length() + LENGTH).append(PREFIX);
        for (int i = 0; i < LENGTH; i++) {
            id.append(ALPHABET[RANDOM.nextInt(ALPHABET.length)]);
        }
        return id.toString();
    }

    /** True when {@code value} has the shape of a display id; says nothing about whether a tenant carries it. */
    public static boolean isValid(String value) {
        return value != null && FORMAT.matcher(value).matches();
    }
}
