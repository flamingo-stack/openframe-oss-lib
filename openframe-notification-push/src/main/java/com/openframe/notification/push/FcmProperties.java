package com.openframe.notification.push;

import lombok.Data;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@Data
@ConfigurationProperties(prefix = "openframe.push.fcm")
public class FcmProperties implements InitializingBean {

    static final int FCM_PAYLOAD_LIMIT_BYTES = 4096;

    private static final int ENVELOPE_HEADROOM_BYTES = 512;

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

        int worstCase = maxTitleBytes + maxBodyBytes + maxContextBytes + ENVELOPE_HEADROOM_BYTES;
        if (worstCase > FCM_PAYLOAD_LIMIT_BYTES) {
            throw new IllegalStateException(String.format(
                    "openframe.push.fcm budgets do not fit FCM's %d-byte limit: title(%d) + body(%d) "
                            + "+ context(%d) + envelope(%d) = %d. Lower one — otherwise every push is "
                            + "rejected with INVALID_ARGUMENT.",
                    FCM_PAYLOAD_LIMIT_BYTES, maxTitleBytes, maxBodyBytes, maxContextBytes,
                    ENVELOPE_HEADROOM_BYTES, worstCase));
        }
    }
}
