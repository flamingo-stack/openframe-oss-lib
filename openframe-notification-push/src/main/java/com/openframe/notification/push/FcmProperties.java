package com.openframe.notification.push;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@Data
@ConfigurationProperties(prefix = "openframe.push.fcm")
public class FcmProperties {

    /** Fixed by the FCM protocol, not a preference. */
    static final int FCM_PAYLOAD_LIMIT_BYTES = 4096;

    /** Room for the data keys, JSON punctuation and FCM's own envelope. */
    private static final int ENVELOPE_HEADROOM_BYTES = 512;

    /** Differs per environment, and must be explicit: user-scoped ADC carries no project. */
    private String projectId;

    /**
     * Budgets are in BYTES, not characters: the limit FCM enforces is a byte limit, and a CJK or
     * emoji-heavy title costs up to four bytes per character — a character budget would either
     * under-use the payload or blow past it depending on the language.
     */
    private int maxTitleBytes = 200;

    private int maxBodyBytes = 1200;

    private int maxContextBytes = 2000;

    /** A hung provider must not hold the caller's request thread — the push runs inline. */
    private Duration connectTimeout = Duration.ofSeconds(5);

    private Duration readTimeout = Duration.ofSeconds(10);

    /**
     * The budgets only protect anything if their SUM fits the limit. Raise one on its own and FCM
     * starts rejecting with INVALID_ARGUMENT — for every device at once, and (since INVALID_ARGUMENT
     * is deliberately not treated as a dead token) with nothing in our logs pointing at the config.
     * Fail at startup instead.
     */
    void validate() {
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
