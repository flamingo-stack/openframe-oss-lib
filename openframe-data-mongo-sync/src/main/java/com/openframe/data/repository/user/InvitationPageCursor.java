package com.openframe.data.repository.user;

import java.time.Instant;
import java.util.Optional;

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
        if (raw == null) {
            return Optional.empty();
        }
        int split = raw.indexOf(SEPARATOR);
        if (split < 0 || split == raw.length() - 1) {
            return Optional.empty();
        }
        try {
            Instant createdAt = split == 0 ? null : Instant.ofEpochMilli(Long.parseLong(raw.substring(0, split)));
            return Optional.of(new InvitationPageCursor(createdAt, raw.substring(split + 1)));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }
}
