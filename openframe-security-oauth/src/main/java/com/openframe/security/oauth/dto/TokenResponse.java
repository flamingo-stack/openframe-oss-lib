package com.openframe.security.oauth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TokenResponse {
    private String access_token;
    private String refresh_token;
    private String token_type;
    private Integer expires_in;
    private String scope;
}


