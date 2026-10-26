package com.openframe.delivery.sweep;

import com.openframe.delivery.config.DeliveryProperties.Backoff;
import com.openframe.delivery.config.DeliveryProperties.Policy;
import org.junit.jupiter.api.Test;

import java.util.random.RandomGenerator;

import static org.assertj.core.api.Assertions.assertThat;

class RetryBackoffTest {

    private static final long ACK_THRESHOLD = 30L;
    private static final long MAX_INTERVAL = 300L;

    @Test
    void delaySeconds_multiplierOne_theSameWaitEveryTime() {
        // setup
        RetryBackoff backoff = new RetryBackoff();
        Policy policy = policy(1.0, MAX_INTERVAL, 0.0);

        // execution + verifications
        assertThat(backoff.delaySeconds(1, policy)).isEqualTo(30L);
        assertThat(backoff.delaySeconds(2, policy)).isEqualTo(30L);
        assertThat(backoff.delaySeconds(7, policy)).isEqualTo(30L);
    }

    @Test
    void delaySeconds_multiplierTwo_doublesUpToTheCap() {
        // setup
        RetryBackoff backoff = new RetryBackoff();
        Policy policy = policy(2.0, MAX_INTERVAL, 0.0);

        // execution + verifications
        assertThat(backoff.delaySeconds(1, policy)).isEqualTo(60L);
        assertThat(backoff.delaySeconds(2, policy)).isEqualTo(120L);
        assertThat(backoff.delaySeconds(3, policy)).isEqualTo(240L);
        assertThat(backoff.delaySeconds(4, policy)).isEqualTo(MAX_INTERVAL);
        assertThat(backoff.delaySeconds(20, policy)).isEqualTo(MAX_INTERVAL);
    }

    @Test
    void delaySeconds_jitter_spreadsTheWaitAroundTheCappedValue() {
        // setup
        Policy policy = policy(2.0, MAX_INTERVAL, 0.2);

        // execution + verifications
        assertThat(new RetryBackoff(drawing(1.0)).delaySeconds(1, policy)).isEqualTo(72L);
        assertThat(new RetryBackoff(drawing(0.0)).delaySeconds(1, policy)).isEqualTo(48L);
        assertThat(new RetryBackoff(drawing(0.5)).delaySeconds(1, policy)).isEqualTo(60L);
    }

    @Test
    void delaySeconds_jitterOnAShortWait_neverBelowOneSecond() {
        // setup
        Policy policy = policy(1.0, MAX_INTERVAL, 1.0);
        policy.setAckThresholdSeconds(1L);

        // execution + verifications
        assertThat(new RetryBackoff(drawing(0.0)).delaySeconds(1, policy)).isEqualTo(1L);
    }

    private static Policy policy(double multiplier, long maxIntervalSeconds, double jitter) {
        Backoff backoff = new Backoff();
        backoff.setMultiplier(multiplier);
        backoff.setMaxIntervalSeconds(maxIntervalSeconds);
        backoff.setJitter(jitter);
        Policy policy = new Policy();
        policy.setAckThresholdSeconds(ACK_THRESHOLD);
        policy.setBackoff(backoff);
        return policy;
    }

    // a generator whose next draw is known, so the spread can be asserted exactly
    private static RandomGenerator drawing(double value) {
        return new RandomGenerator() {
            @Override
            public double nextDouble() {
                return value;
            }

            @Override
            public long nextLong() {
                throw new UnsupportedOperationException();
            }
        };
    }
}
