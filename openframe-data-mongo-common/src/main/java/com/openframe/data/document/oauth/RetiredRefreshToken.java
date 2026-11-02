package com.openframe.data.document.oauth;

import java.time.Instant;

/**
 * A refresh token that rotation replaced, kept for a short grace window so that a client which
 * never received the replacement (a cancelled request, a dropped response) can still recover.
 */
public record RetiredRefreshToken(String value, Instant retiredAt) {
}
