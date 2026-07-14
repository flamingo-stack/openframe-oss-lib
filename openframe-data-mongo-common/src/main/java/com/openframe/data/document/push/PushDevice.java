package com.openframe.data.document.push;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * A push-capable device registered against a user. One user may own many devices, and a token is
 * owned by exactly one user at a time — re-registering an existing token re-associates it to the
 * caller (a device handed to another user after logout must not keep receiving the old user's pushes).
 *
 * <p>The collection is deliberately NOT named {@code devices} — that is taken by RMM machines.
 *
 * <p>Uniqueness is {@code {tenantId, token}} rather than {@code token} alone: today tenants are
 * isolated by database and {@code tenantId} is null, so the compound index degenerates to
 * uniqueness on the token; if {@code openframe.tenant-isolation.enabled} is ever switched on and
 * collections become shared, the same index keeps a token from colliding across tenants.
 */
@Document(collection = "push_devices")
@CompoundIndexes({
        @CompoundIndex(name = "tenant_token_unique", def = "{'tenantId': 1, 'token': 1}", unique = true),
        @CompoundIndex(name = "tenant_user", def = "{'tenantId': 1, 'userId': 1}")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PushDevice implements TenantScoped {

    @Id
    private String id;

    private String tenantId;

    private String userId;

    /** Provider registration token (FCM). */
    private String token;

    private PushPlatform platform;

    /**
     * APNs environment (sandbox/production). Unused on the FCM-for-both path — Firebase resolves the
     * APNs gateway itself — and kept only so a direct-APNs provider stays possible without a migration.
     */
    private String environment;

    private Instant createdAt;

    private Instant updatedAt;
}
