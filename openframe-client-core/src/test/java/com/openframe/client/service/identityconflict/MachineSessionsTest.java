package com.openframe.client.service.identityconflict;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class MachineSessionsTest {

    private static final Instant START = Instant.parse("2026-11-23T10:00:00Z");
    private static final Duration TTL = Duration.ofMinutes(10);

    private static Instant minute(int minute) {
        return START.plus(Duration.ofMinutes(minute));
    }

    @Test
    void heartbeat_oneSession_noConflict() {
        // setup
        MachineSessions sessions = new MachineSessions(TTL);

        // execution / verifications
        assertThat(sessions.heartbeat("a", minute(0))).isEmpty();
        assertThat(sessions.heartbeat("a", minute(1))).isEmpty();
    }

    @Test
    void heartbeat_restartedClient_newSessionReplacesTheOldOne_noConflict() {
        // setup
        MachineSessions sessions = new MachineSessions(TTL);
        sessions.heartbeat("before-restart", minute(0));

        // execution / verifications
        assertThat(sessions.heartbeat("after-restart", minute(1))).isEmpty();
        assertThat(sessions.heartbeat("after-restart", minute(2))).isEmpty();
    }

    @Test
    void heartbeat_twoSessionsTakingTurns_conflictNamesTheNewerSession() {
        // setup
        MachineSessions sessions = new MachineSessions(TTL);
        sessions.heartbeat("original", minute(0));
        sessions.heartbeat("clone", minute(1));

        // execution
        var conflict = sessions.heartbeat("original", minute(2));

        // verifications
        assertThat(conflict).contains("clone");
        assertThat(sessions.heartbeat("clone", minute(3))).contains("clone");
    }

    @Test
    void heartbeat_sessionSilentLongerThanTheTtl_isForgotten_noConflict() {
        // setup
        MachineSessions sessions = new MachineSessions(TTL);
        sessions.heartbeat("old", minute(0));
        sessions.heartbeat("new", minute(1));

        // execution
        var conflict = sessions.heartbeat("old", minute(30));

        // verifications
        assertThat(conflict).isEmpty();
    }

    @Test
    void prune_allSessionsSilentLongerThanTheTtl_reportsEmpty() {
        // setup
        MachineSessions sessions = new MachineSessions(TTL);
        sessions.heartbeat("a", minute(0));

        // execution / verifications
        assertThat(sessions.prune(minute(5))).isFalse();
        assertThat(sessions.prune(minute(11))).isTrue();
    }
}
