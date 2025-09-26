package com.openframe.security.oauth.dto;

public record OAuthCallbackResult(
        String tenantId,
        String redirectTo,
        TokenResponse tokens
) {
}


