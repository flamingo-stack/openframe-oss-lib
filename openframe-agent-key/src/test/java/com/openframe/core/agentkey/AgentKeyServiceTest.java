package com.openframe.core.agentkey;

import com.openframe.core.exception.NotFoundException;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AgentKeyServiceTest {

    private static final Instant CREATED_AT = Instant.parse("2026-11-16T17:00:00Z");

    @Test
    void currentAndRotateReachTheProviderOfTheType() {
        AgentKeyService service = new AgentKeyService(List.of(
                new StubProvider(AgentKeyType.REGISTRATION), new StubProvider(AgentKeyType.LOG)));

        assertThat(service.current(AgentKeyType.LOG).key()).isEqualTo("log-current");
        assertThat(service.rotate(AgentKeyType.LOG).key()).isEqualTo("log-rotated");
        assertThat(service.current(AgentKeyType.REGISTRATION).key()).isEqualTo("registration-current");
        assertThat(service.rotate(AgentKeyType.REGISTRATION).key()).isEqualTo("registration-rotated");
    }

    @Test
    void aTypeWithoutProviderIsNotFound() {
        AgentKeyService service = new AgentKeyService(List.of(new StubProvider(AgentKeyType.LOG)));

        assertThatThrownBy(() -> service.rotate(AgentKeyType.REGISTRATION))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining("registration");
    }

    @Test
    void twoProvidersOfOneTypeFailConstruction() {
        List<AgentKeyProvider> providers = List.of(new StubProvider(AgentKeyType.LOG), new StubProvider(AgentKeyType.LOG));

        assertThatThrownBy(() -> new AgentKeyService(providers))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("LOG");
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
