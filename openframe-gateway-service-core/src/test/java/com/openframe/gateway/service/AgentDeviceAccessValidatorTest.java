package com.openframe.gateway.service;

import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.reactive.repository.tool.ReactiveToolConnectionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentDeviceAccessValidatorTest {

    @Mock
    private ReactiveToolConnectionRepository toolConnectionRepository;

    private AgentDeviceAccessValidator validator;

    private static final String MACHINE_ID = "machine-abc123";
    private static final String AGENT_TOOL_ID = "tactical-agent-xyz";
    private static final String OTHER_MACHINE_ID = "machine-other999";

    @BeforeEach
    void setUp() {
        validator = new AgentDeviceAccessValidator(toolConnectionRepository);
    }

    @Nested
    @DisplayName("canAccess — happy path")
    class AllowedAccess {

        @Test
        @DisplayName("returns true when JWT machineId matches ToolConnection owner")
        void allowsWhenMachineIdMatches() {
            ToolConnection conn = toolConnection(MACHINE_ID, AGENT_TOOL_ID);
            when(toolConnectionRepository.findFirstByAgentToolIdOrderByConnectedAtDesc(AGENT_TOOL_ID))
                    .thenReturn(Mono.just(conn));

            StepVerifier.create(validator.canAccess(MACHINE_ID, AGENT_TOOL_ID))
                    .expectNext(true)
                    .verifyComplete();
        }
    }

    @Nested
    @DisplayName("canAccess — denied")
    class DeniedAccess {

        @Test
        @DisplayName("returns false when JWT machineId does NOT match ToolConnection owner — cross-device attack")
        void deniesWhenMachineIdMismatch() {
            ToolConnection conn = toolConnection(OTHER_MACHINE_ID, AGENT_TOOL_ID);
            when(toolConnectionRepository.findFirstByAgentToolIdOrderByConnectedAtDesc(AGENT_TOOL_ID))
                    .thenReturn(Mono.just(conn));

            StepVerifier.create(validator.canAccess(MACHINE_ID, AGENT_TOOL_ID))
                    .expectNext(false)
                    .verifyComplete();
        }

        @Test
        @DisplayName("returns false when no ToolConnection exists for agentToolId")
        void deniesWhenNoConnectionFound() {
            when(toolConnectionRepository.findFirstByAgentToolIdOrderByConnectedAtDesc(AGENT_TOOL_ID))
                    .thenReturn(Mono.empty());

            StepVerifier.create(validator.canAccess(MACHINE_ID, AGENT_TOOL_ID))
                    .expectNext(false)
                    .verifyComplete();
        }

        @Test
        @DisplayName("returns false when jwtMachineId is null — no machine_id claim in JWT")
        void deniesWhenJwtMachineIdIsNull() {
            StepVerifier.create(validator.canAccess(null, AGENT_TOOL_ID))
                    .expectNext(false)
                    .verifyComplete();
        }

        @Test
        @DisplayName("returns false when agentToolId is null — no target in path")
        void deniesWhenAgentToolIdIsNull() {
            StepVerifier.create(validator.canAccess(MACHINE_ID, null))
                    .expectNext(false)
                    .verifyComplete();
        }

        @Test
        @DisplayName("returns false when agentToolId is blank")
        void deniesWhenAgentToolIdIsBlank() {
            StepVerifier.create(validator.canAccess(MACHINE_ID, "  "))
                    .expectNext(false)
                    .verifyComplete();
        }
    }

    private ToolConnection toolConnection(String machineId, String agentToolId) {
        ToolConnection conn = new ToolConnection();
        conn.setMachineId(machineId);
        conn.setAgentToolId(agentToolId);
        return conn;
    }
}
