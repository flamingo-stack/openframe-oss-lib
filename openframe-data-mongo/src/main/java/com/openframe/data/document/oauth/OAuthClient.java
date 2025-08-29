package com.openframe.data.document.oauth;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Document(collection = "oauth_clients")
public class OAuthClient {
    @Id
    private String id;
    private String clientId;
    private String clientSecret;
    private String machineId;
    private String[] redirectUris;
    private String[] grantTypes;  // "authorization_code", "password", "client_credentials", "refresh_token"
    private String[] scopes;
    private String[] roles = new String[]{};
    private boolean enabled = true;
} 