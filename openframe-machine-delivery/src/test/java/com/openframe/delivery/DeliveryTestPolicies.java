package com.openframe.delivery;

import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import com.openframe.delivery.DeliveryProperties.Policy;

final class DeliveryTestPolicies {

    static final long ACK_THRESHOLD = 30L;
    static final int MAX_ATTEMPTS = 3;
    static final int BACKOFF_MULTIPLIER = 2;
    static final long MAX_RETRY_INTERVAL = 300L;
    static final int BATCH_SIZE = 500;
    static final long RECONNECT_WINDOW = 86_400L;
    static final long RESULT_TIMEOUT = 600L;
    static final long TTL = 604_800L;

    private DeliveryTestPolicies() {
    }

    static DeliveryProperties properties() {
        Policy defaults = new Policy();
        defaults.setAckThresholdSeconds(ACK_THRESHOLD);
        defaults.setMaxAttempts(MAX_ATTEMPTS);
        defaults.setBackoffMultiplier(BACKOFF_MULTIPLIER);
        defaults.setMaxRetryIntervalSeconds(MAX_RETRY_INTERVAL);
        defaults.setBatchSize(BATCH_SIZE);
        defaults.setOfflineBehavior(ScheduleOfflineBehavior.RETRY_ON_RECONNECT);
        defaults.setReconnectWindowSeconds(RECONNECT_WINDOW);
        defaults.setResultTimeoutSeconds(RESULT_TIMEOUT);
        defaults.setTtlSeconds(TTL);
        DeliveryProperties properties = new DeliveryProperties();
        properties.setDefaults(defaults);
        return properties;
    }
}
