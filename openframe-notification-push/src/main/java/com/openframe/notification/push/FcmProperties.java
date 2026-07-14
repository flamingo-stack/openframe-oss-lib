package com.openframe.notification.push;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "openframe.push.fcm")
public class FcmProperties {

    /** Differs per environment, and must be explicit: user-scoped ADC carries no project. */
    private String projectId;

    /**
     * FCM rejects a message over ~4KB with INVALID_ARGUMENT. These three caps keep us under it, and
     * they matter more than they look: an oversized payload fails for EVERY token in the batch, and a
     * batch-wide failure is indistinguishable from a batch of dead tokens.
     */
    private int maxTitleChars = 120;

    private int maxBodyChars = 700;

    private int maxContextBytes = 2000;

    /** A hung provider must not hold the caller's request thread — push runs inline. */
    private int connectTimeoutMillis = 5_000;

    private int readTimeoutMillis = 10_000;
}
