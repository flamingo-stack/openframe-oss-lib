package com.openframe.gatewayauth;

import com.openframe.core.exception.ErrorCode;
import org.springframework.security.access.AccessDeniedException;

public interface AccessDeniedObserver {

    void onAccessDenied(ErrorCode code, AccessDeniedException denied);
}
