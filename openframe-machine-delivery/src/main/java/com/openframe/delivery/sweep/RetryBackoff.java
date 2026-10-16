package com.openframe.delivery.sweep;

import com.openframe.delivery.config.DeliveryProperties.Backoff;
import com.openframe.delivery.config.DeliveryProperties.Policy;
import org.springframework.stereotype.Component;

import java.util.Random;
import java.util.random.RandomGenerator;

@Component
public class RetryBackoff {

    private static final long SHORTEST_WAIT_SECONDS = 1L;

    private final RandomGenerator random;

    public RetryBackoff() {
        this(new Random());
    }

    RetryBackoff(RandomGenerator random) {
        this.random = random;
    }

    public long delaySeconds(int attempt, Policy policy) {
        Backoff backoff = policy.getBackoff();
        double growth = Math.pow(backoff.getMultiplier(), attempt);
        long delay = (long) (policy.getAckThresholdSeconds() * growth);
        long capped = Math.min(delay, backoff.getMaxIntervalSeconds());
        return spread(capped, backoff.getJitter());
    }

    // every row of a rollout comes due on the same tick otherwise, and the sweep re-publishes the whole fleet at once
    private long spread(long delay, double jitter) {
        if (jitter == 0) {
            return delay;
        }
        double offset = (random.nextDouble() * 2 - 1) * jitter;
        long spread = Math.round(delay * (1 + offset));
        return Math.max(SHORTEST_WAIT_SECONDS, spread);
    }
}
