package com.openframe.client.service.auth;

import com.openframe.data.document.oauth.OAuthClient;
import com.openframe.security.jwt.JwtService;
import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.stereotype.Component;

import java.time.Instant;

import static org.springframework.util.StringUtils.hasText;

@Component
public class AccessTokenGenerator {

    private static final String ISSUER = "https://auth.openframe.com";
    private static final String MACHINE_ID_CLAIM = "machine_id";
    private static final String GRANT_TYPE_CLAIM = "grant_type";
    private static final String ROLES_CLAIM = "roles";
    public static final String TENANT_ID_CLAIM = "tenant_id";

    private final JwtService jwtService;
    @Getter
    private final int expirationSeconds;
    private final String tenantId;

    public AccessTokenGenerator(
            JwtService jwtService,
            @Value("${security.oauth2.token.access.expiration-seconds}") int expirationSeconds,
            @Value("${openframe.client.agent-token.tenant-id}") String tenantId
    ) {
        this.jwtService = jwtService;
        this.expirationSeconds = expirationSeconds;
        this.tenantId = tenantId;
    }

    public String generate(OAuthClient client, String grantType) {
        JwtClaimsSet claims = buildClaims(client, grantType);
        return jwtService.generateToken(claims);
    }

    private JwtClaimsSet buildClaims(OAuthClient client, String grantType) {
        Instant issuedAt = Instant.now();
        Instant expiresAt = issuedAt.plusSeconds(expirationSeconds);
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
                .issuer(ISSUER)
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .subject(client.getClientId())
                .claim(MACHINE_ID_CLAIM, client.getMachineId())
                .claim(GRANT_TYPE_CLAIM, grantType)
                .claim(ROLES_CLAIM, client.getRoles());
        if (isTenantScoped()) {
            claims.claim(TENANT_ID_CLAIM, tenantId);
        }
        return claims.build();
    }

    // Self-hosted OSS has no tenants and sets the property to an empty string.
    private boolean isTenantScoped() {
        return hasText(tenantId);
    }
}
