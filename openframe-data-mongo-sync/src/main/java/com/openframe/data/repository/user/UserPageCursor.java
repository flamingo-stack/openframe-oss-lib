package com.openframe.data.repository.user;

import com.openframe.core.exception.InvalidCursorException;

import java.util.Optional;

import static org.apache.commons.lang3.StringUtils.isBlank;

/**
 * Keyset position in the {@code (email, _id)} order of {@link CustomUserRepository#findUsersPage}.
 * Split on the last separator: an email may contain {@code _}, a user id (UUID or ObjectId) never does.
 */
public record UserPageCursor(String email, String id) {

    private static final char SEPARATOR = '_';

    public static String of(String email, String id) {
        return email + SEPARATOR + id;
    }

    static Optional<UserPageCursor> parse(String raw) {
        if (isBlank(raw)) {
            return Optional.empty();
        }
        int split = raw.lastIndexOf(SEPARATOR);
        if (split <= 0 || split == raw.length() - 1) {
            throw new InvalidCursorException();
        }
        return Optional.of(new UserPageCursor(raw.substring(0, split), raw.substring(split + 1)));
    }
}
