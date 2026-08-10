package com.openframe.data.document.notification;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Map;

/** No document means everything is enabled — readers must treat absence as the default, so no backfill is ever needed. */
@Document(collection = "notification_settings")
@CompoundIndex(name = "tenant_user_unique", def = "{'tenantId': 1, 'userId': 1}", unique = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationSettings implements TenantScoped {

    @Id
    private String id;

    private String tenantId;

    private String userId;

    /**
     * Legacy master switch from the push-only era. Kept mirrored to {@link #enabled} on every write so
     * a rolled-back reader still honours the user's choice; {@link #masterEnabled()} prefers the new field.
     */
    @Builder.Default
    private boolean pushEnabled = true;

    /** Master switch over ALL notification delivery (in-app, NATS, push). Null = legacy document, fall back to pushEnabled. */
    private Boolean enabled;

    /** Only explicit false mutes; an absent key — including groups added after this document was saved — is enabled. */
    private Map<NotificationSettingGroup, Boolean> typeSettings;

    private Instant createdAt;

    private Instant updatedAt;

    public boolean masterEnabled() {
        return enabled != null ? enabled : pushEnabled;
    }

    public boolean groupEnabled(NotificationSettingGroup group) {
        return group == null || typeSettings == null || typeSettings.getOrDefault(group, true);
    }

    /** The whole decision: does this user receive a notification of the given group right now? */
    public boolean allows(NotificationSettingGroup group) {
        return masterEnabled() && groupEnabled(group);
    }
}
