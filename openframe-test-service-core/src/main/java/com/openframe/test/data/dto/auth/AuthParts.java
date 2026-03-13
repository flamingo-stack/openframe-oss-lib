package com.openframe.test.data.dto.auth;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;

import java.util.Map;

@Data
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class AuthParts {
    private String email;
    private String password;
    private String tenantId;
    private String state;
    private String codeChallenge;
    private String codeVerifier;
    private Map<String, String> cookies;
    private String authorizationCode;
}
