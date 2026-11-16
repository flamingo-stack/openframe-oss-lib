package com.openframe.core.agentkey;

import com.openframe.core.exception.NotFoundException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AgentKeyTypeTest {

    @Test
    void resolvesEachTypeFromItsPath() {
        assertThat(AgentKeyType.fromPath("registration")).isEqualTo(AgentKeyType.REGISTRATION);
        assertThat(AgentKeyType.fromPath("log")).isEqualTo(AgentKeyType.LOG);
    }

    @Test
    void unknownOrDifferentlyCasedPathIsNotFound() {
        assertThatThrownBy(() -> AgentKeyType.fromPath("LOG")).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> AgentKeyType.fromPath("api")).isInstanceOf(NotFoundException.class);
    }
}
