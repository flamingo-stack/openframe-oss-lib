package com.openframe.gateway.config.ws;

import com.openframe.gateway.metrics.GatewayTrafficMetrics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.buffer.DefaultDataBufferFactory;
import org.springframework.web.reactive.socket.CloseStatus;
import org.springframework.web.reactive.socket.WebSocketMessage;
import org.springframework.web.reactive.socket.WebSocketMessage.Type;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import tools.jackson.databind.ObjectMapper;

import java.util.List;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NatsSubjectFilteringWebSocketSessionDecoratorTest {

    private static final DefaultDataBufferFactory BUFFERS = new DefaultDataBufferFactory();
    private static final String PATH = "/ws/nats";
    private static final String TENANT = "tenant-1";
    private static final String MACHINE_ID = "m-1";
    private static final String DEVICE = "DEVICE";
    private static final String OWN_SUBSCRIBE = "SUB machine.m-1.command-execution 1\r\n";
    private static final String FOREIGN_SUBSCRIBE = "SUB machine.m-2.command-execution 1\r\n";
    private static final String FOREIGN_SUBSCRIBE_REFUSED = "SUB _DENIED.machine.m-2.command-execution 1\r\n";
    private static final String CONNECT_WITH_PASSWORD = "CONNECT {\"user\":\"service\",\"pass\":\"secret\"}\r\n";

    @Mock private WebSocketSession delegate;
    @Mock private GatewayTrafficMetrics gatewayTrafficMetrics;

    private NatsSubjectFilterProperties properties;
    private NatsSubjectFilteringWebSocketSessionDecorator decorator;

    @BeforeEach
    void setUp() {
        properties = new NatsSubjectFilterProperties();
        properties.setEnabled(true);
        properties.setEnforce(true);
        NatsClientIdentity identity = NatsClientIdentity.device(MACHINE_ID);
        decorator = new NatsSubjectFilteringWebSocketSessionDecorator(delegate, PATH, TENANT, identity, properties,
                new ObjectMapper(), gatewayTrafficMetrics);
    }

    @Test
    void receive_allowedSubscribe_originalMessageRelayed() {
        // setup
        WebSocketMessage original = message(Type.TEXT, OWN_SUBSCRIBE);
        when(delegate.receive()).thenReturn(Flux.just(original));

        // execution
        List<WebSocketMessage> relayed = receiveAll();

        // verifications
        assertThat(relayed).containsExactly(original);
        verifyNoInteractions(gatewayTrafficMetrics);
    }

    @Test
    void receive_refusedSubscribeEnforcing_rewrittenMessageOfTheSameType() {
        // setup
        WebSocketMessage original = message(Type.BINARY, FOREIGN_SUBSCRIBE);
        when(delegate.receive()).thenReturn(Flux.just(original));
        when(delegate.bufferFactory()).thenReturn(BUFFERS);

        // execution
        List<WebSocketMessage> relayed = receiveAll();

        // verifications
        assertThat(relayed)
                .extracting(WebSocketMessage::getType, WebSocketMessage::getPayloadAsText)
                .containsExactly(tuple(Type.BINARY, FOREIGN_SUBSCRIBE_REFUSED));
        verify(gatewayTrafficMetrics).recordNatsCommandRefused("SUB", DEVICE, true);
    }

    @Test
    void receive_refusedSubscribeObserving_originalRelayedAndCounted() {
        // setup
        properties.setEnforce(false);
        WebSocketMessage original = message(Type.BINARY, FOREIGN_SUBSCRIBE);
        when(delegate.receive()).thenReturn(Flux.just(original));

        // execution
        List<WebSocketMessage> relayed = receiveAll();

        // verifications
        assertThat(relayed).containsExactly(original);
        verify(gatewayTrafficMetrics).recordNatsCommandRefused("SUB", DEVICE, false);
    }

    @Test
    void receive_pingFrame_relayedUntouched() {
        // setup
        WebSocketMessage ping = message(Type.PING, "");
        when(delegate.receive()).thenReturn(Flux.just(ping));

        // execution
        List<WebSocketMessage> relayed = receiveAll();

        // verifications
        assertThat(relayed).containsExactly(ping);
    }

    @Test
    void receive_filterDisabled_relayedUntouched() {
        // setup
        properties.setEnabled(false);
        WebSocketMessage original = message(Type.BINARY, FOREIGN_SUBSCRIBE);
        when(delegate.receive()).thenReturn(Flux.just(original));

        // execution
        List<WebSocketMessage> relayed = receiveAll();

        // verifications
        assertThat(relayed).containsExactly(original);
        verifyNoInteractions(gatewayTrafficMetrics);
    }

    @Test
    void receive_commandSplitAcrossFrames_oneMessageOnceTheLineIsComplete() {
        // setup
        WebSocketMessage head = message(Type.BINARY, "SUB machine.m-1");
        WebSocketMessage tail = message(Type.BINARY, ".command-execution 1\r\n");
        when(delegate.receive()).thenReturn(Flux.just(head, tail));
        when(delegate.bufferFactory()).thenReturn(BUFFERS);

        // execution
        List<WebSocketMessage> relayed = receiveAll();

        // verifications
        assertThat(relayed)
                .extracting(WebSocketMessage::getPayloadAsText)
                .containsExactly(OWN_SUBSCRIBE);
    }

    @Test
    void receive_connectWithPasswordEnforcing_sessionClosedAndNothingRelayed() {
        // setup
        WebSocketMessage connect = message(Type.BINARY, CONNECT_WITH_PASSWORD);
        WebSocketMessage subscribe = message(Type.BINARY, OWN_SUBSCRIBE);
        when(delegate.receive()).thenReturn(Flux.just(connect, subscribe));
        when(delegate.close(CloseStatus.POLICY_VIOLATION)).thenReturn(Mono.empty());

        // execution
        List<WebSocketMessage> relayed = receiveAll();

        // verifications
        assertThat(relayed).isEmpty();
        verify(delegate).close(CloseStatus.POLICY_VIOLATION);
        verify(gatewayTrafficMetrics).recordNatsCommandRefused("CONNECT", DEVICE, true);
    }

    @Test
    void receive_connectWithPasswordObserving_relayedAndCounted() {
        // setup
        properties.setEnforce(false);
        WebSocketMessage connect = message(Type.BINARY, CONNECT_WITH_PASSWORD);
        WebSocketMessage subscribe = message(Type.BINARY, OWN_SUBSCRIBE);
        when(delegate.receive()).thenReturn(Flux.just(connect, subscribe));

        // execution
        List<WebSocketMessage> relayed = receiveAll();

        // verifications
        assertThat(relayed).containsExactly(connect, subscribe);
        verify(delegate, never()).close(CloseStatus.POLICY_VIOLATION);
        verify(gatewayTrafficMetrics).recordNatsCommandRefused("CONNECT", DEVICE, false);
    }

    private List<WebSocketMessage> receiveAll() {
        return decorator.receive().collectList().block();
    }

    private static WebSocketMessage message(Type type, String payload) {
        byte[] bytes = payload.getBytes(UTF_8);
        return new WebSocketMessage(type, BUFFERS.wrap(bytes));
    }
}
