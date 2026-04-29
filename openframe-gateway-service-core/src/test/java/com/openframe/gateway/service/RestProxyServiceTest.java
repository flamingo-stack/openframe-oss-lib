package com.openframe.gateway.service;

import com.openframe.data.reactive.repository.tool.ReactiveIntegratedToolRepository;
import com.openframe.gateway.upstream.ToolUpstreamResolverRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.web.util.pattern.PathPatternParser;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RestProxyServiceTest {

    @Mock
    private ReactiveIntegratedToolRepository toolRepository;
    @Mock
    private ToolUpstreamResolverRegistry upstreamRegistry;
    @Mock
    private ToolApiKeyHeadersResolver apiKeyHeadersResolver;
    @Mock
    private AgentDeviceAccessValidator agentDeviceAccessValidator;
    @Mock
    private ServerHttpRequest request;

    private RestProxyService service;

    private static final String TOOL_ID = "tactical-rmm";
    private static final String MACHINE_ID = "machine-abc123";
    private static final String AGENT_TOOL_ID = "tactical-agent-xyz";

    @BeforeEach
    void setUp() {
        service = new RestProxyService(toolRepository, upstreamRegistry, apiKeyHeadersResolver, agentDeviceAccessValidator);
    }

    @Nested
    @DisplayName("proxyAgentRequest — device access validation")
    class DeviceAccessValidation {

        @Test
        @DisplayName("returns 403 Forbidden when validator denies access — cross-device attack blocked")
        void returns403WhenAccessDenied() {
            mockRequestPath("/tools/agent/" + TOOL_ID + "/" + AGENT_TOOL_ID + "/api/v3/agents/");
            when(agentDeviceAccessValidator.canAccess(MACHINE_ID, AGENT_TOOL_ID))
                    .thenReturn(Mono.just(false));

            Mono<ResponseEntity<String>> result = service.proxyAgentRequest(TOOL_ID, request, null, MACHINE_ID);

            StepVerifier.create(result)
                    .assertNext(response -> assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN))
                    .verifyComplete();

            verify(toolRepository, never()).findById(anyString());
        }

        @Test
        @DisplayName("returns 403 when path has no agentToolId segment (validator receives null)")
        void returns403WhenNoAgentToolIdInPath() {
            mockRequestPath("/tools/agent/" + TOOL_ID);
            when(agentDeviceAccessValidator.canAccess(eq(MACHINE_ID), eq(null)))
                    .thenReturn(Mono.just(false));

            StepVerifier.create(service.proxyAgentRequest(TOOL_ID, request, null, MACHINE_ID))
                    .assertNext(response -> assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN))
                    .verifyComplete();
        }

        @Test
        @DisplayName("returns 403 when jwtMachineId is null — no machine_id in JWT")
        void returns403WhenJwtMachineIdIsNull() {
            mockRequestPath("/tools/agent/" + TOOL_ID + "/" + AGENT_TOOL_ID + "/api/v3/agents/");
            when(agentDeviceAccessValidator.canAccess(null, AGENT_TOOL_ID))
                    .thenReturn(Mono.just(false));

            StepVerifier.create(service.proxyAgentRequest(TOOL_ID, request, null, null))
                    .assertNext(response -> assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN))
                    .verifyComplete();
        }

        @Test
        @DisplayName("returns 404 when validator passes but tool is not found")
        void returns404WhenToolNotFound() {
            mockRequestPath("/tools/agent/" + TOOL_ID + "/" + AGENT_TOOL_ID + "/api/v3/agents/");
            when(agentDeviceAccessValidator.canAccess(MACHINE_ID, AGENT_TOOL_ID))
                    .thenReturn(Mono.just(true));
            when(toolRepository.findById(TOOL_ID)).thenReturn(Mono.empty());

            StepVerifier.create(service.proxyAgentRequest(TOOL_ID, request, null, MACHINE_ID))
                    .assertNext(response -> assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND))
                    .verifyComplete();
        }
    }

    @Nested
    @DisplayName("extractAgentToolId — path parsing")
    class AgentToolIdExtraction {

        @Test
        @DisplayName("extracts agentToolId from deep path correctly")
        void extractsFromDeepPath() {
            mockRequestPath("/tools/agent/" + TOOL_ID + "/" + AGENT_TOOL_ID + "/api/v3/agents/");
            when(agentDeviceAccessValidator.canAccess(any(), any())).thenReturn(Mono.just(false));

            service.proxyAgentRequest(TOOL_ID, request, null, MACHINE_ID).block();

            verify(agentDeviceAccessValidator).canAccess(MACHINE_ID, AGENT_TOOL_ID);
        }

        @Test
        @DisplayName("extracts agentToolId when it is the last path segment")
        void extractsWhenLastSegment() {
            mockRequestPath("/tools/agent/" + TOOL_ID + "/" + AGENT_TOOL_ID);
            when(agentDeviceAccessValidator.canAccess(any(), any())).thenReturn(Mono.just(false));

            service.proxyAgentRequest(TOOL_ID, request, null, MACHINE_ID).block();

            verify(agentDeviceAccessValidator).canAccess(MACHINE_ID, AGENT_TOOL_ID);
        }
    }

    private void mockRequestPath(String path) {
        org.springframework.http.server.RequestPath requestPath =
                org.springframework.http.server.RequestPath.parse(path, null);
        when(request.getPath()).thenReturn(requestPath);
    }
}
