package com.openframe.security.oauth.exception;

import com.openframe.core.exception.BaseException;
import lombok.Getter;

import static com.openframe.core.exception.ErrorCode.AUTH_SERVER_UNAVAILABLE;

// The refresh could not be completed for a reason on our side of the auth server, so the
// user's refresh token says nothing about the outcome: the client must keep its session.
@Getter
public class RefreshUpstreamException extends BaseException {

    private final RefreshUpstreamReason reason;

    public RefreshUpstreamException(RefreshUpstreamReason reason) {
        super(AUTH_SERVER_UNAVAILABLE, reason.getHttpStatus(), reason.getMessage());
        this.reason = reason;
    }

    public RefreshUpstreamException(RefreshUpstreamReason reason, Throwable cause) {
        super(AUTH_SERVER_UNAVAILABLE, reason.getHttpStatus(), reason.getMessage(), cause);
        this.reason = reason;
    }
}
