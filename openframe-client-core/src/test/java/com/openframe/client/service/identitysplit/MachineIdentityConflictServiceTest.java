package com.openframe.client.service.identitysplit;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import io.nats.client.Connection;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class MachineIdentityConflictServiceTest {

    private static final String MACHINE = "m-1";

    @Mock
    private Connection natsConnection;

    private final MutableClock clock = new MutableClock(Instant.parse("2026-11-23T10:00:00Z"));
    private SimpleMeterRegistry meterRegistry;
    private MachineIdentityConflictService service;

    @BeforeEach
    void setUp() {
        meterRegistry = new SimpleMeterRegistry();
        service = new MachineIdentityConflictService(natsConnection, new JsonMapper(), meterRegistry, clock);
    }

    private void alternate(String... sessions) {
        for (String session : sessions) {
            service.onHeartbeat(MACHINE, session);
            clock.advance(Duration.ofSeconds(30));
        }
    }

    @Test
    void onHeartbeat_twoDevicesSharingTheMachine_asksTheNewerSessionToSplitOff() {
        // execution
        alternate("original", "clone", "original");

        // verifications
        ArgumentCaptor<byte[]> payload = ArgumentCaptor.forClass(byte[].class);
        verify(natsConnection).publish(org.mockito.ArgumentMatchers.eq("machine.m-1.identity-split"), payload.capture());
        assertThat(new String(payload.getValue(), StandardCharsets.UTF_8)).isEqualTo("{\"sessionId\":\"clone\"}");
        assertThat(meterRegistry.counter(MachineIdentityConflictService.CONFLICTS_COUNTER).count()).isEqualTo(1.0);
    }

    @Test
    void onHeartbeat_clientRestart_asksNothing() {
        // execution
        alternate("before-restart", "after-restart", "after-restart");

        // verifications
        verify(natsConnection, never()).publish(anyString(), any(byte[].class));
    }

    @Test
    void onHeartbeat_conflictGoesOn_asksAgainOnlyAfterTheRequestInterval() {
        // execution
        alternate("original", "clone", "original", "clone", "original");
        clock.advance(MachineIdentityConflictService.REQUEST_INTERVAL);
        alternate("clone");

        // verifications
        verify(natsConnection, times(2)).publish(anyString(), any(byte[].class));
        assertThat(meterRegistry.counter(MachineIdentityConflictService.CONFLICTS_COUNTER).count()).isEqualTo(4.0);
    }

    @Test
    void takeSplitRequest_onlyTheRequestedSessionOnlyOnce() {
        // setup
        alternate("original", "clone", "original");

        // execution / verifications
        assertThat(service.takeSplitRequest(MACHINE, "original")).isFalse();
        assertThat(service.takeSplitRequest("other-machine", "clone")).isFalse();
        assertThat(service.takeSplitRequest(MACHINE, "clone")).isTrue();
        assertThat(service.takeSplitRequest(MACHINE, "clone")).isFalse();
    }

    @Test
    void takeSplitRequest_nothingRequested_refused() {
        // setup
        alternate("only");

        // execution / verifications
        assertThat(service.takeSplitRequest(MACHINE, "only")).isFalse();
    }

    @Test
    void takeSplitRequest_requestOlderThanTheSessionTtl_refused() {
        // setup
        alternate("original", "clone", "original");
        clock.advance(MachineIdentityConflictService.SESSION_TTL);

        // execution / verifications
        assertThat(service.takeSplitRequest(MACHINE, "clone")).isFalse();
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
