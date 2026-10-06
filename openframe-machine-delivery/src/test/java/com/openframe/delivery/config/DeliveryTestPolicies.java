package com.openframe.delivery.config;

import com.openframe.data.document.delivery.DeliveryOfflineBehavior;
import com.openframe.delivery.config.DeliveryProperties.Policy;
import com.openframe.delivery.config.DeliveryProperties.Sweep;

public final class DeliveryTestPolicies {

    public static final long ACK_THRESHOLD = 30L;
    public static final int MAX_ATTEMPTS = 3;
    public static final int BACKOFF_MULTIPLIER = 2;
    public static final long MAX_RETRY_INTERVAL = 300L;
    public static final int BATCH_SIZE = 500;
    public static final long SWEEP_INTERVAL_MILLIS = 30_000L;
    public static final long RECONNECT_WINDOW = 86_400L;
    public static final long RESULT_TIMEOUT = 600L;
    public static final long TTL = 604_800L;

    private DeliveryTestPolicies() {
    }

    public static DeliveryProperties properties() {
        Policy defaults = new Policy();
        defaults.setAckThresholdSeconds(ACK_THRESHOLD);
        defaults.setMaxAttempts(MAX_ATTEMPTS);
        defaults.setBackoffMultiplier(BACKOFF_MULTIPLIER);
        defaults.setMaxRetryIntervalSeconds(MAX_RETRY_INTERVAL);
        defaults.setOfflineBehavior(DeliveryOfflineBehavior.RETRY_ON_RECONNECT);
        defaults.setReconnectWindowSeconds(RECONNECT_WINDOW);
        defaults.setResultTimeoutSeconds(RESULT_TIMEOUT);
        defaults.setTtlSeconds(TTL);
        Sweep sweep = new Sweep();
        sweep.setInterval(SWEEP_INTERVAL_MILLIS);
        sweep.setBatchSize(BATCH_SIZE);
        DeliveryProperties properties = new DeliveryProperties();
        properties.setDefaults(defaults);
        properties.setSweep(sweep);
        return properties;
    }
}
