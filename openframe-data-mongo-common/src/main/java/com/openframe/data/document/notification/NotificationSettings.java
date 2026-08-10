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

    /** Master over ALL delivery (in-app, NATS, push); absent = enabled. */
    private Boolean enabled;

    /** Only explicit false mutes; an absent key — including groups added after this document was saved — is enabled. */
    private Map<NotificationSettingGroup, Boolean> typeSettings;

    private Instant createdAt;

    private Instant updatedAt;

    public boolean isMasterEnabled() {
        return enabled == null || enabled;
    }

    public boolean isGroupEnabled(NotificationSettingGroup group) {
        return group == null || typeSettings == null || typeSettings.getOrDefault(group, true);
    }

    public boolean isEnabledFor(NotificationSettingGroup group) {
        return isMasterEnabled() && isGroupEnabled(group);
    }
}
