package com.openframe.gatewayauth;

import com.openframe.core.exception.ErrorCode;

public interface AccessDeniedObserver {

    void onAccessDenied(ErrorCode code);
}
