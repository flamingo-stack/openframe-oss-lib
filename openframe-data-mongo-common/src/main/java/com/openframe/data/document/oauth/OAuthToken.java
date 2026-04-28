package com.openframe.data.document.oauth;

import com.openframe.data.document.TenantScoped;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Document(collection = "oauth_tokens")
public class OAuthToken implements TenantScoped {
    @Id
    private String id;

    @Indexed
    private String tenantId;

    private String userId;
    private String accessToken;
    private String refreshToken;
    private Instant accessTokenExpiry;
    private Instant refreshTokenExpiry;
    private String clientId;
    private String[] scopes;
} 
