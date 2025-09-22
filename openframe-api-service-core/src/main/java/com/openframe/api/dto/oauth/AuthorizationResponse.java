package com.openframe.api.dto.oauth;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AuthorizationResponse {
    private String code;
    private String state;
    private String redirectUri;
} 