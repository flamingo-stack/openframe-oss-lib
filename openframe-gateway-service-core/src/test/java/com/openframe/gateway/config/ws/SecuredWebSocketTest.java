package com.openframe.gateway.config.ws;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.reactive.socket.WebSocketSession;
import org.springframework.web.server.ServerWebExchange;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SecuredWebSocketTest {

    private static final String SESSION_ID = "session-1";
    private static final String PATH = "/ws/tools/meshcentral-server/meshrelay.ashx";
    private static final String SUBJECT = "agent_8daa5e90-707c-4fab-8cda-d11550b0d26b";

    @Mock private ServerWebExchange exchange;
    @Mock private WebSocketSession session;

    private SecuredWebSocket socket;

    @BeforeEach
    void setUp() {
        socket = new SecuredWebSocket(exchange, session, PATH, SUBJECT, true);
    }

    @Test
    void getSessionId_openSession_returnsTheSessionsId() {
        // setup
        when(session.getId()).thenReturn(SESSION_ID);

        // execution
        String sessionId = socket.getSessionId();

        // verifications
        assertThat(sessionId).isEqualTo(SESSION_ID);
    }

    @Test
    void getters_constructedSocket_returnTheRequestDetails() {
        // setup

        // execution
        SecuredWebSocket built = socket;

        // verifications
        assertThat(built)
                .extracting(SecuredWebSocket::getExchange, SecuredWebSocket::getSession, SecuredWebSocket::getPath,
                        SecuredWebSocket::getSub, SecuredWebSocket::isDebugPath)
                .containsExactly(exchange, session, PATH, SUBJECT, true);
    }
}
