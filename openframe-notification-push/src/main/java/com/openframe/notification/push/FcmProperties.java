package com.openframe.notification.push;

import lombok.Data;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@Data
@ConfigurationProperties(prefix = "openframe.push.fcm")
public class FcmProperties implements InitializingBean {

    private String projectId;

    private int maxTitleBytes = 200;

    private int maxBodyBytes = 1200;

    private int maxContextBytes = 2000;

    private Duration connectTimeout = Duration.ofSeconds(5);

    private Duration readTimeout = Duration.ofSeconds(10);

    @Override
    public void afterPropertiesSet() {
        validate();
    }

    void validate() {
        if (projectId == null || projectId.isBlank()) {
            throw new IllegalStateException(
                    "openframe.push.fcm.project-id must be set when push is enabled — "
                            + "Application Default Credentials carry no project and FCM cannot infer one");
        }

        if (maxTitleBytes < 0 || maxBodyBytes < 0 || maxContextBytes < 0) {
            throw new IllegalStateException(String.format(
                    "openframe.push.fcm budgets must not be negative: title(%d), body(%d), context(%d)",
                    maxTitleBytes, maxBodyBytes, maxContextBytes));
        }

        long worstCase = (long) maxTitleBytes + maxBodyBytes + maxContextBytes
                + FcmPushSender.ENVELOPE_HEADROOM_BYTES;
        if (worstCase > FcmPushSender.FCM_PAYLOAD_LIMIT_BYTES) {
            throw new IllegalStateException(String.format(
                    "openframe.push.fcm budgets do not fit FCM's %d-byte limit: title(%d) + body(%d) "
                            + "+ context(%d) + envelope(%d) = %d. Lower one — otherwise every push is "
                            + "rejected with INVALID_ARGUMENT.",
                    FcmPushSender.FCM_PAYLOAD_LIMIT_BYTES, maxTitleBytes, maxBodyBytes, maxContextBytes,
                    FcmPushSender.ENVELOPE_HEADROOM_BYTES, worstCase));
        }
    }
}
