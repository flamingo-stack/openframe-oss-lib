package com.openframe.data.repository.user;

import com.openframe.core.exception.InvalidCursorException;

import java.time.Instant;
import java.util.Optional;

import static org.apache.commons.lang3.StringUtils.isBlank;

/**
 * Keyset position in the {@code (createdAt desc, _id desc)} order of
 * {@link CustomInvitationRepository#findOpenInvitationsPage}. A missing {@code createdAt} is encoded as an
 * empty prefix.
 */
public record InvitationPageCursor(Instant createdAt, String id) {

    private static final char SEPARATOR = '_';

    public static String of(Instant createdAt, String id) {
        return (createdAt != null ? Long.toString(createdAt.toEpochMilli()) : "") + SEPARATOR + id;
    }

    static Optional<InvitationPageCursor> parse(String raw) {
        if (isBlank(raw)) {
            return Optional.empty();
        }
        int split = raw.indexOf(SEPARATOR);
        if (split < 0 || split == raw.length() - 1) {
            throw new InvalidCursorException();
        }
        try {
            Instant createdAt = split == 0 ? null : Instant.ofEpochMilli(Long.parseLong(raw.substring(0, split)));
            return Optional.of(new InvitationPageCursor(createdAt, raw.substring(split + 1)));
        } catch (NumberFormatException e) {
            throw new InvalidCursorException(e);
        }
    }
}
