package com.openframe.delivery.agent;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AgentVersionFloorTest {

    @Test
    void everyVersion_admitsAnyAgentEvenOneWithoutAKnownVersion() {
        // execution + verifications
        assertThat(AgentVersionFloor.EVERY_VERSION.admits("0.0.1")).isTrue();
        assertThat(AgentVersionFloor.EVERY_VERSION.admits(null)).isTrue();
        assertThat(AgentVersionFloor.EVERY_VERSION.isForEveryVersion()).isTrue();
    }

    @Test
    void withMinVersion_thatVersionAndUpOnlyUnknownStaysBelow() {
        // setup
        AgentVersionFloor floor = AgentVersionFloor.from("1.6.0");

        // execution + verifications
        assertThat(floor.admits("1.6.0")).isTrue();
        assertThat(floor.admits("1.10.0")).isTrue();
        assertThat(floor.admits("1.5.9")).isFalse();
        assertThat(floor.admits("")).isFalse();
        assertThat(floor.admits(null)).isFalse();
        assertThat(floor.isForEveryVersion()).isFalse();
    }

    @Test
    void from_blankMinVersion_isEveryVersion() {
        // execution + verifications
        assertThat(AgentVersionFloor.from(" ")).isEqualTo(AgentVersionFloor.EVERY_VERSION);
        assertThat(AgentVersionFloor.from(null)).isEqualTo(AgentVersionFloor.EVERY_VERSION);
    }
}
