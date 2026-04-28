package com.openframe.data.document.oauth;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "oauth_registered_clients")
@CompoundIndex(name = "tenant_clientId_idx", def = "{'tenantId': 1, 'clientId': 1}", unique = true)
public class MongoRegisteredClient implements TenantScoped {
    @Id
    private String id;

    @Indexed
    private String tenantId;

    private String clientId;

    private String clientSecret;

    private Set<String> authenticationMethods;
    private Set<String> grantTypes;
    private Set<String> redirectUris;
    private Set<String> scopes;

    private boolean requireProofKey;
    private boolean requireAuthorizationConsent;

    private long accessTokenTtlSeconds;
    private long refreshTokenTtlSeconds;
    private boolean reuseRefreshTokens;
}
