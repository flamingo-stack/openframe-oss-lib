package com.openframe.data.document.auth;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Apple refresh token kept per user solely to satisfy App Store guideline 5.1.1(v): when an
 * account that used Sign in with Apple is deleted, its Apple tokens must be revoked via
 * {@code appleid.apple.com/auth/revoke}. Refreshed on every Apple sign-in (web or native);
 * deleted once revocation succeeds. The token is encrypted at rest.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "apple_user_tokens")
public class AppleUserToken implements TenantScoped {

    @Id
    private String id;
    @Indexed
    private String tenantId;
    @Indexed(unique = true)
    private String userId;
    /** Client the token was issued to (web Services ID or the app's bundle id) — revocation must use the same one. */
    private String clientId;
    /** Apple refresh token, encrypted with the platform {@code EncryptionService}. */
    private String refreshToken;
    private Instant updatedAt;
}
