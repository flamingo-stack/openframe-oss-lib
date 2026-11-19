package com.openframe.gatewayauth;

import org.springframework.security.access.AccessDeniedException;

public interface AccessDeniedObserver {

    void onAccessDenied(AccessDeniedException denied);
}
