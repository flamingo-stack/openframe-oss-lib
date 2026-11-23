package com.openframe.gateway.config.ws.nats.session;

import com.openframe.gateway.config.ws.nats.NatsClientContext;
import com.openframe.gateway.config.ws.nats.NatsSubjectFilterProperties;
import com.openframe.gateway.config.ws.nats.NatsTestContexts;
import com.openframe.gateway.config.ws.nats.validation.ConnectCredentialsValidator;
import com.openframe.gateway.config.ws.nats.validation.JetStreamConsumerCreateValidator;
import com.openframe.gateway.config.ws.nats.validation.NatsCommandValidator;
import com.openframe.gateway.config.ws.nats.validation.NatsCommandValidationService;
import com.openframe.gateway.config.ws.nats.validation.PublishSubjectValidator;
import com.openframe.gateway.config.ws.nats.validation.SubscribeSubjectValidator;
import com.openframe.gateway.config.ws.nats.jetstream.ConsumerCreateRequestParser;
import com.openframe.gateway.config.ws.nats.jetstream.JetStreamApiSubjectParser;
import com.openframe.gateway.config.ws.nats.jetstream.SubjectPolicyConsumerAuthorizer;
import com.openframe.gateway.config.ws.nats.protocol.NatsCommandAssembler;
import com.openframe.gateway.config.ws.nats.protocol.NatsConnectOptionsParser;
import com.openframe.gateway.config.ws.nats.protocol.NatsControlLineParser;
import com.openframe.gateway.metrics.GatewayTrafficMetrics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Captor;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.reactivestreams.Publisher;
import org.springframework.core.io.buffer.DefaultDataBufferFactory;
import org.springframework.web.reactive.socket.CloseStatus;
import org.springframework.web.reactive.socket.WebSocketMessage;
import org.springframework.web.reactive.socket.WebSocketMessage.Type;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
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
    private static final Duration ERROR_WAIT = Duration.ofSeconds(2);
    private static final long MAX_PAYLOAD_BYTES = 1024;
    private static final String DEVICE = "DEVICE";
    private static final String OWN_SUBSCRIBE = "SUB machine.m-1.command-execution 1\r\n";
    private static final String FOREIGN_SUBSCRIBE = "SUB machine.m-2.command-execution 1\r\n";
    private static final String FOREIGN_SUBSCRIBE_ERROR =
            "-ERR 'Permissions Violation for Subscription to \"machine.m-2.command-execution\"'\r\n";
    private static final String FOREIGN_PUBLISH = "PUB machine.m-2.heartbeat 2\r\nhi\r\n";
    private static final String FOREIGN_PUBLISH_ERROR =
            "-ERR 'Permissions Violation for Publish to \"machine.m-2.heartbeat\"'\r\n";
    private static final String CHAT_CONSUMER_CREATE_SUBJECT = "$JS.API.CONSUMER.CREATE.CHAT_CHUNKS.c1.chat.d-1.message";
    private static final String CHAT_CONSUMER_CREATE_BODY = "{\"config\":{\"filter_subject\":\"chat.d-1.message\"}}";
    private static final String CHAT_CONSUMER_CREATE =
            "PUB " + CHAT_CONSUMER_CREATE_SUBJECT + " " + CHAT_CONSUMER_CREATE_BODY.length() + "\r\n"
                    + CHAT_CONSUMER_CREATE_BODY + "\r\n";
    private static final String CHAT_CONSUMER_CREATE_ERROR =
            "-ERR 'Permissions Violation for Publish to \"" + CHAT_CONSUMER_CREATE_SUBJECT + "\"'\r\n";
    private static final String PING = "PING\r\n";
    private static final String CONNECT_WITH_PASSWORD = "CONNECT {\"user\":\"service\",\"pass\":\"secret\"}\r\n";

    @Mock private WebSocketSession delegate;
    @Mock private GatewayTrafficMetrics gatewayTrafficMetrics;

    @Captor private ArgumentCaptor<Publisher<WebSocketMessage>> sentCaptor;

    private NatsSubjectFilterProperties properties;
    private NatsCommandValidationService validationService;

    @BeforeEach
    void setUp() {
        properties = new NatsSubjectFilterProperties();
        properties.setEnabled(true);
        properties.setEnforce(true);
        ObjectMapper objectMapper = new ObjectMapper();
        List<NatsCommandValidator> checks = List.of(
                new ConnectCredentialsValidator(new NatsConnectOptionsParser(objectMapper)),
                new SubscribeSubjectValidator(),
                new PublishSubjectValidator(),
                new JetStreamConsumerCreateValidator(new JetStreamApiSubjectParser(),
                        new ConsumerCreateRequestParser(objectMapper), List.of(new SubjectPolicyConsumerAuthorizer())));
        validationService = new NatsCommandValidationService(checks);
    }

    @Test
    void receive_allowedSubscribe_relayedByteForByte() {
        // setup
        NatsSubjectFilteringWebSocketSessionDecorator decorator = decoratorFor(NatsTestContexts.device());
        when(delegate.receive()).thenReturn(Flux.just(message(Type.TEXT, OWN_SUBSCRIBE)));
        when(delegate.bufferFactory()).thenReturn(BUFFERS);

        // execution
        List<WebSocketMessage> relayed = receiveAll(decorator);

        // verifications
        assertThat(relayed)
                .extracting(WebSocketMessage::getType, WebSocketMessage::getPayloadAsText)
                .containsExactly(tuple(Type.TEXT, OWN_SUBSCRIBE));
        verifyNoInteractions(gatewayTrafficMetrics);
    }

    @Test
    void receive_refusedSubscribeEnforcing_droppedAndClientGetsThePermissionsError() {
        // setup
        NatsSubjectFilteringWebSocketSessionDecorator decorator = decoratorFor(NatsTestContexts.device());
        when(delegate.receive()).thenReturn(Flux.just(message(Type.BINARY, FOREIGN_SUBSCRIBE)));
        when(delegate.bufferFactory()).thenReturn(BUFFERS);
        when(delegate.send(sentCaptor.capture())).thenReturn(Mono.empty());

        // execution
        List<WebSocketMessage> relayed = receiveAll(decorator);
        decorator.send(Flux.empty());
        WebSocketMessage toClient = firstSent();

        // verifications
        assertThat(relayed).isEmpty();
        assertThat(toClient.getType()).isEqualTo(Type.BINARY);
        assertThat(toClient.getPayloadAsText()).isEqualTo(FOREIGN_SUBSCRIBE_ERROR);
        verify(gatewayTrafficMetrics).recordNatsCommandRefused("SUB", DEVICE, true);
    }

    @Test
    void receive_refusedPublishEnforcing_payloadDroppedTooAndRestRelayed() {
        // setup
        NatsSubjectFilteringWebSocketSessionDecorator decorator = decoratorFor(NatsTestContexts.device());
        when(delegate.receive()).thenReturn(Flux.just(message(Type.TEXT, FOREIGN_PUBLISH + PING)));
        when(delegate.bufferFactory()).thenReturn(BUFFERS);
        when(delegate.send(sentCaptor.capture())).thenReturn(Mono.empty());

        // execution
        List<WebSocketMessage> relayed = receiveAll(decorator);
        decorator.send(Flux.empty());
        WebSocketMessage toClient = firstSent();

        // verifications
        assertThat(relayed)
                .extracting(WebSocketMessage::getPayloadAsText)
                .containsExactly(PING);
        assertThat(toClient.getPayloadAsText()).isEqualTo(FOREIGN_PUBLISH_ERROR);
        verify(gatewayTrafficMetrics).recordNatsCommandRefused("PUB", DEVICE, true);
    }

    @Test
    void receive_deviceCreatesChatConsumerWithoutAStreamRule_refused() {
        // setup
        NatsSubjectFilteringWebSocketSessionDecorator decorator = decoratorFor(NatsTestContexts.device());
        when(delegate.receive()).thenReturn(Flux.just(message(Type.BINARY, CHAT_CONSUMER_CREATE)));
        when(delegate.bufferFactory()).thenReturn(BUFFERS);
        when(delegate.send(sentCaptor.capture())).thenReturn(Mono.empty());

        // execution
        List<WebSocketMessage> relayed = receiveAll(decorator);
        decorator.send(Flux.empty());
        WebSocketMessage toClient = firstSent();

        // verifications
        assertThat(relayed).isEmpty();
        assertThat(toClient.getPayloadAsText()).isEqualTo(CHAT_CONSUMER_CREATE_ERROR);
    }

    @Test
    void receive_userCreatesChatConsumer_relayed() {
        // setup
        NatsSubjectFilteringWebSocketSessionDecorator decorator = decoratorFor(NatsTestContexts.user());
        when(delegate.receive()).thenReturn(Flux.just(message(Type.BINARY, CHAT_CONSUMER_CREATE)));
        when(delegate.bufferFactory()).thenReturn(BUFFERS);

        // execution
        List<WebSocketMessage> relayed = receiveAll(decorator);

        // verifications
        assertThat(relayed)
                .extracting(WebSocketMessage::getPayloadAsText)
                .containsExactly(CHAT_CONSUMER_CREATE);
        verifyNoInteractions(gatewayTrafficMetrics);
    }

    @Test
    void receive_refusedSubscribeObserving_relayedAndCounted() {
        // setup
        properties.setEnforce(false);
        NatsSubjectFilteringWebSocketSessionDecorator decorator = decoratorFor(NatsTestContexts.device());
        when(delegate.receive()).thenReturn(Flux.just(message(Type.BINARY, FOREIGN_SUBSCRIBE)));
        when(delegate.bufferFactory()).thenReturn(BUFFERS);

        // execution
        List<WebSocketMessage> relayed = receiveAll(decorator);

        // verifications
        assertThat(relayed)
                .extracting(WebSocketMessage::getPayloadAsText)
                .containsExactly(FOREIGN_SUBSCRIBE);
        verify(gatewayTrafficMetrics).recordNatsCommandRefused("SUB", DEVICE, false);
    }

    @Test
    void send_upstreamMessages_relayedToTheClient() {
        // setup
        NatsSubjectFilteringWebSocketSessionDecorator decorator = decoratorFor(NatsTestContexts.device());
        WebSocketMessage fromNats = message(Type.BINARY, PING);
        when(delegate.send(sentCaptor.capture())).thenReturn(Mono.empty());

        // execution
        decorator.send(Flux.just(fromNats));
        WebSocketMessage toClient = firstSent();

        // verifications
        assertThat(toClient).isSameAs(fromNats);
    }

    @Test
    void receive_pingFrame_relayedUntouched() {
        // setup
        NatsSubjectFilteringWebSocketSessionDecorator decorator = decoratorFor(NatsTestContexts.device());
        when(delegate.receive()).thenReturn(Flux.just(message(Type.PING, "")));
        when(delegate.bufferFactory()).thenReturn(BUFFERS);

        // execution
        List<WebSocketMessage> relayed = receiveAll(decorator);

        // verifications
        assertThat(relayed)
                .extracting(WebSocketMessage::getType)
                .containsExactly(Type.PING);
    }

    @Test
    void receive_filterDisabled_relayedUntouched() {
        // setup
        properties.setEnabled(false);
        NatsSubjectFilteringWebSocketSessionDecorator decorator = decoratorFor(NatsTestContexts.device());
        when(delegate.receive()).thenReturn(Flux.just(message(Type.BINARY, FOREIGN_SUBSCRIBE)));
        when(delegate.bufferFactory()).thenReturn(BUFFERS);

        // execution
        List<WebSocketMessage> relayed = receiveAll(decorator);

        // verifications
        assertThat(relayed)
                .extracting(WebSocketMessage::getPayloadAsText)
                .containsExactly(FOREIGN_SUBSCRIBE);
        verifyNoInteractions(gatewayTrafficMetrics);
    }

    @Test
    void receive_commandSplitAcrossFrames_oneMessageOnceTheLineIsComplete() {
        // setup
        NatsSubjectFilteringWebSocketSessionDecorator decorator = decoratorFor(NatsTestContexts.device());
        WebSocketMessage head = message(Type.BINARY, "SUB machine.m-1");
        WebSocketMessage tail = message(Type.BINARY, ".command-execution 1\r\n");
        when(delegate.receive()).thenReturn(Flux.just(head, tail));
        when(delegate.bufferFactory()).thenReturn(BUFFERS);

        // execution
        List<WebSocketMessage> relayed = receiveAll(decorator);

        // verifications
        assertThat(relayed)
                .extracting(WebSocketMessage::getPayloadAsText)
                .containsExactly(OWN_SUBSCRIBE);
    }

    @Test
    void receive_connectWithPasswordEnforcing_sessionClosedAndNothingRelayed() {
        // setup
        NatsSubjectFilteringWebSocketSessionDecorator decorator = decoratorFor(NatsTestContexts.device());
        when(delegate.receive()).thenReturn(Flux.just(message(Type.BINARY, CONNECT_WITH_PASSWORD), message(Type.BINARY, OWN_SUBSCRIBE)));
        when(delegate.close(CloseStatus.POLICY_VIOLATION)).thenReturn(Mono.empty());

        // execution
        List<WebSocketMessage> relayed = receiveAll(decorator);

        // verifications
        assertThat(relayed).isEmpty();
        verify(delegate).close(CloseStatus.POLICY_VIOLATION);
        verify(gatewayTrafficMetrics).recordNatsCommandRefused("CONNECT", DEVICE, true);
    }

    @Test
    void receive_connectWithPasswordObserving_relayedAndCounted() {
        // setup
        properties.setEnforce(false);
        NatsSubjectFilteringWebSocketSessionDecorator decorator = decoratorFor(NatsTestContexts.device());
        when(delegate.receive()).thenReturn(Flux.just(message(Type.BINARY, CONNECT_WITH_PASSWORD), message(Type.BINARY, OWN_SUBSCRIBE)));
        when(delegate.bufferFactory()).thenReturn(BUFFERS);

        // execution
        List<WebSocketMessage> relayed = receiveAll(decorator);

        // verifications
        assertThat(relayed)
                .extracting(WebSocketMessage::getPayloadAsText)
                .containsExactly(CONNECT_WITH_PASSWORD, OWN_SUBSCRIBE);
        verify(delegate, never()).close(CloseStatus.POLICY_VIOLATION);
        verify(gatewayTrafficMetrics).recordNatsCommandRefused("CONNECT", DEVICE, false);
    }

    @Test
    void receive_unparsableLineObserving_relayedAndTheRestOfTheSessionUnfiltered() {
        // setup
        properties.setEnforce(false);
        NatsSubjectFilteringWebSocketSessionDecorator decorator = decoratorFor(NatsTestContexts.device());
        String unparsable = "PUB machine.m-1.heartbeat abc\r\n";
        when(delegate.receive()).thenReturn(Flux.just(message(Type.BINARY, unparsable), message(Type.BINARY, FOREIGN_SUBSCRIBE)));
        when(delegate.bufferFactory()).thenReturn(BUFFERS);

        // execution
        List<WebSocketMessage> relayed = receiveAll(decorator);

        // verifications
        assertThat(relayed)
                .extracting(WebSocketMessage::getPayloadAsText)
                .containsExactly(unparsable, FOREIGN_SUBSCRIBE);
        verify(gatewayTrafficMetrics).recordNatsCommandRefused("PROTOCOL", DEVICE, false);
        verify(gatewayTrafficMetrics, never()).recordNatsCommandRefused("SUB", DEVICE, false);
    }

    @Test
    void receive_unparsableLineEnforcing_sessionClosed() {
        // setup
        NatsSubjectFilteringWebSocketSessionDecorator decorator = decoratorFor(NatsTestContexts.device());
        when(delegate.receive()).thenReturn(Flux.just(message(Type.BINARY, "PUB machine.m-1.heartbeat abc\r\n")));
        when(delegate.close(CloseStatus.POLICY_VIOLATION)).thenReturn(Mono.empty());

        // execution
        List<WebSocketMessage> relayed = receiveAll(decorator);

        // verifications
        assertThat(relayed).isEmpty();
        verify(delegate).close(CloseStatus.POLICY_VIOLATION);
    }

    private NatsSubjectFilteringWebSocketSessionDecorator decoratorFor(NatsClientContext context) {
        NatsCommandAssembler assembler = new NatsCommandAssembler(new NatsControlLineParser(), MAX_PAYLOAD_BYTES);
        NatsRefusalReporter reporter = new NatsRefusalReporter(gatewayTrafficMetrics, context);
        return new NatsSubjectFilteringWebSocketSessionDecorator(delegate, context, properties, assembler, validationService, reporter);
    }

    private static List<WebSocketMessage> receiveAll(NatsSubjectFilteringWebSocketSessionDecorator decorator) {
        return decorator.receive().collectList().block();
    }

    private WebSocketMessage firstSent() {
        Publisher<WebSocketMessage> sent = sentCaptor.getValue();
        return Flux.from(sent).next().block(ERROR_WAIT);
    }

    private static WebSocketMessage message(Type type, String payload) {
        byte[] bytes = payload.getBytes(UTF_8);
        return new WebSocketMessage(type, BUFFERS.wrap(bytes));
    }
}
