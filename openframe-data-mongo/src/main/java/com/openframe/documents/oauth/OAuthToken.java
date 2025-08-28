package com.openframe.documents.oauth;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Document(collection = "oauth_tokens")
public class OAuthToken {
    @Id
    private String id;
    private String userId;
    private String accessToken;
    private String refreshToken;
    private Instant accessTokenExpiry;
    private Instant refreshTokenExpiry;
    private String clientId;
    private String[] scopes;
} 