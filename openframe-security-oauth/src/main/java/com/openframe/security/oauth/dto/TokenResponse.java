package com.openframe.security.oauth.dto;

public record TokenResponse(
        String access_token,
        String refresh_token,
        String token_type,
        Integer expires_in,
        String scope
) {
}


