package com.openframe.client.controller;

import com.openframe.client.exception.MachineDeletedException;
import com.openframe.client.service.AgentAuthService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentAuthControllerTest {

    private static final String GRANT_TYPE = "refresh_token";
    private static final String REFRESH_TOKEN = "refresh-1";
    private static final String MESSAGE = "Machine is deleted";

    @Mock private AgentAuthService agentAuthService;

    @InjectMocks private AgentAuthController controller;

    @Test
    void getClientToken_machineDeleted_answersGone() {
        // setup
        when(agentAuthService.issueClientToken(GRANT_TYPE, REFRESH_TOKEN, null, null))
                .thenThrow(new MachineDeletedException(MESSAGE));

        // execution
        ResponseEntity<?> response = controller.getClientToken(GRANT_TYPE, REFRESH_TOKEN, null, null);

        // verifications
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.GONE);
        assertThat(response.getBody()).isEqualTo(Map.of("message", MESSAGE));
    }

    @Test
    void getClientToken_credentialRefused_answersUnauthorized() {
        // setup
        when(agentAuthService.issueClientToken(GRANT_TYPE, REFRESH_TOKEN, null, null))
                .thenThrow(new IllegalArgumentException("Refresh token has expired"));

        // execution
        ResponseEntity<?> response = controller.getClientToken(GRANT_TYPE, REFRESH_TOKEN, null, null);

        // verifications
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
