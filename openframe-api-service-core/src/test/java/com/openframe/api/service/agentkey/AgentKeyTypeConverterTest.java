package com.openframe.api.service.agentkey;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AgentKeyTypeConverterTest {

    private final AgentKeyTypeConverter converter = new AgentKeyTypeConverter();

    @Test
    void resolvesEachTypeFromItsPath() {
        assertThat(converter.convert("registration")).isEqualTo(AgentKeyType.REGISTRATION);
        assertThat(converter.convert("log")).isEqualTo(AgentKeyType.LOG);
    }

    @ParameterizedTest
    @ValueSource(strings = {"LOG", "api", ""})
    void rejectsAnUnknownOrDifferentlyCasedPath(String path) {
        assertThatThrownBy(() -> converter.convert(path))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unknown agent key type");
    }
}
