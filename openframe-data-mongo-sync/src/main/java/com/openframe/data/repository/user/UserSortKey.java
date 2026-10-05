package com.openframe.data.repository.user;

import java.time.LocalDateTime;

/**
 * Position in the (createdAt desc, id desc) page order: createdAt is not unique, so the row id breaks
 * ties deterministically. A null createdAt is a row that carries no creation date; those sort last.
 *
 * <p>A record, because callers also hand this out as an opaque cursor and read it back with Jackson.
 */
public record UserSortKey(LocalDateTime createdAt, String id) {
}
