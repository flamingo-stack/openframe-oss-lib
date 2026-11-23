package com.openframe.client.service.identityconflict;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

class MachineIdentityConflictServiceTest {

    private static final String MACHINE = "m-1";

    private final MutableClock clock = new MutableClock(Instant.parse("2026-11-23T10:00:00Z"));
    private SimpleMeterRegistry meterRegistry;
    private MachineIdentityConflictService service;

    @BeforeEach
    void setUp() {
        meterRegistry = new SimpleMeterRegistry();
        service = new MachineIdentityConflictService(meterRegistry, clock);
    }

    private void heartbeats(String... sessions) {
        for (String session : sessions) {
            service.onHeartbeat(MACHINE, session);
            clock.advance(Duration.ofSeconds(30));
        }
    }

    private double conflicts() {
        return meterRegistry.counter(MachineIdentityConflictService.CONFLICTS_COUNTER).count();
    }

    @Test
    void onHeartbeat_twoDevicesSharingTheMachine_countsEveryConflictingHeartbeat() {
        // execution
        heartbeats("original", "clone", "original", "clone");

        // verifications
        assertThat(conflicts()).isEqualTo(2.0);
    }

    @Test
    void onHeartbeat_clientRestart_countsNothing() {
        // execution
        heartbeats("before-restart", "after-restart", "after-restart");

        // verifications
        assertThat(conflicts()).isZero();
    }

    @Test
    void onHeartbeat_oneDevice_countsNothing() {
        // execution
        heartbeats("only", "only", "only");

        // verifications
        assertThat(conflicts()).isZero();
    }

    @Test
    void onHeartbeat_machinesAreTrackedApart() {
        // execution
        service.onHeartbeat("m-1", "a");
        service.onHeartbeat("m-2", "b");
        service.onHeartbeat("m-1", "a");
        service.onHeartbeat("m-2", "b");

        // verifications
        assertThat(conflicts()).isZero();
    }

    @Test
    void forgetStale_sessionsSilentLongerThanTheTtl_areForgotten() {
        // setup
        heartbeats("original", "clone");
        clock.advance(MachineIdentityConflictService.SESSION_TTL.plusMinutes(1));

        // execution
        service.forgetStale();
        heartbeats("original", "clone");

        // verifications
        assertThat(conflicts()).isZero();
    }

    private static final class MutableClock extends Clock {
        private Instant now;

        private MutableClock(Instant now) {
            this.now = now;
        }

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneId.of("UTC");
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
