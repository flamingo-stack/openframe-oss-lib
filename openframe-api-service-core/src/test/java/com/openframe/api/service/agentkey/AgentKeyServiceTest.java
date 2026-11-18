package com.openframe.api.service.agentkey;

import com.openframe.core.agentkey.AgentKeyResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AgentKeyServiceTest {

    private static final Instant CREATED_AT = Instant.parse("2026-11-16T17:00:00Z");

    private final AgentKeyService service = new AgentKeyService(List.of(
            new StubProvider(AgentKeyType.REGISTRATION), new StubProvider(AgentKeyType.LOG)));

    @ParameterizedTest
    @EnumSource(AgentKeyType.class)
    void currentAndRotateReachTheProviderOfTheType(AgentKeyType type) {
        assertThat(service.current(type).key()).isEqualTo(type.path() + "-current");
        assertThat(service.rotate(type).key()).isEqualTo(type.path() + "-rotated");
    }

    @Test
    void aTypeWithoutProviderFailsConstruction() {
        List<AgentKeyProvider> providers = List.of(new StubProvider(AgentKeyType.LOG));

        assertThatThrownBy(() -> new AgentKeyService(providers))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("REGISTRATION");
    }

    @Test
    void twoProvidersOfOneTypeFailConstruction() {
        List<AgentKeyProvider> providers = List.of(
                new StubProvider(AgentKeyType.LOG), new StubProvider(AgentKeyType.LOG));

        assertThatThrownBy(() -> new AgentKeyService(providers))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Two agent key providers for LOG");
    }

    private record StubProvider(AgentKeyType type) implements AgentKeyProvider {

        @Override
        public AgentKeyResponse current() {
            return new AgentKeyResponse(type.path() + "-current", CREATED_AT);
        }

        @Override
        public AgentKeyResponse rotate() {
            return new AgentKeyResponse(type.path() + "-rotated", CREATED_AT);
        }
    }
}
