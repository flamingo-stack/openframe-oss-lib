package com.openframe.security.oauth.exception;

import com.openframe.core.exception.UnauthorizedException;

/**
 * The auth server rejected the refresh token (expired, revoked or otherwise
 * invalid grant). Carries a fixed message so upstream OAuth error bodies never
 * leak to clients.
 */
public class InvalidRefreshTokenException extends UnauthorizedException {

    public InvalidRefreshTokenException() {
        super("Refresh token is invalid or expired");
    }
}
