package com.openframe.gateway.config.ws;

import com.openframe.gateway.metrics.GatewayTrafficMetrics;
import lombok.extern.slf4j.Slf4j;
import org.reactivestreams.Publisher;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.core.io.buffer.DataBufferFactory;
import org.springframework.web.reactive.socket.CloseStatus;
import org.springframework.web.reactive.socket.HandshakeInfo;
import org.springframework.web.reactive.socket.WebSocketMessage;
import org.springframework.web.reactive.socket.WebSocketMessage.Type;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;
import reactor.core.publisher.SynchronousSink;
import tools.jackson.databind.ObjectMapper;

import java.nio.ByteBuffer;
import java.util.Arrays;
import java.util.Map;
import java.util.function.Function;

import static java.nio.charset.StandardCharsets.UTF_8;

/**
 * Vets the subjects a NATS websocket client subscribes and publishes to against who the client is.
 * <p>
 * Applied to the client-side session, so {@link #receive()} is the client &rarr; NATS direction —
 * the only one a client controls. NATS &rarr; client ({@link #send}) is relayed untouched, except
 * that the {@code -ERR Permissions Violation} for a refused command is merged into it, worded as
 * NATS words it, so nats.ws and the desktop match it to the subscription they sent. The protocol
 * work is in {@link NatsClientStreamFilter}; this decorator turns frames into bytes and back, and
 * ends the session when the filter says so.
 * <p>
 * The parser keeps state across frames, so once a session relays unfiltered it stays that way:
 * switching the filter off takes effect on open sessions at once, switching it on only on new ones.
 *
 * @see NatsSubjectFilterProperties
 */
@Slf4j
public class NatsSubjectFilteringWebSocketSessionDecorator implements WebSocketSession {

    static final int LOGGED_REFUSALS_PER_SESSION = 10;

    private static final String SUBSCRIBE_ERROR = "-ERR 'Permissions Violation for Subscription to \"%s\"'\r\n";
    private static final String PUBLISH_ERROR = "-ERR 'Permissions Violation for Publish to \"%s\"'\r\n";

    private final WebSocketSession webSocketSession;
    private final String path;
    private final String tenant;
    private final NatsClientIdentity identity;
    private final NatsSubjectFilterProperties properties;
    private final GatewayTrafficMetrics gatewayTrafficMetrics;
    private final NatsClientStreamFilter streamFilter;
    private final Sinks.Many<WebSocketMessage> errorsToClient = Sinks.many().unicast().onBackpressureBuffer();

    private Type currentFrameType = Type.BINARY;
    private int loggedRefusals;
    private boolean relayUnfiltered;
    private boolean rejected;

    public NatsSubjectFilteringWebSocketSessionDecorator(WebSocketSession webSocketSession, String path, String tenant,
                                                         NatsClientIdentity identity, NatsSubjectFilterProperties properties,
                                                         ObjectMapper objectMapper, GatewayTrafficMetrics gatewayTrafficMetrics) {
        this.webSocketSession = webSocketSession;
        this.path = path;
        this.tenant = tenant == null ? "-" : tenant;
        this.identity = identity;
        this.properties = properties;
        this.gatewayTrafficMetrics = gatewayTrafficMetrics;
        NatsSubjectPolicy policy = NatsSubjectPolicy.of(properties, identity);
        this.streamFilter = new NatsClientStreamFilter(policy, objectMapper, this::onViolation);
    }

    @Override
    public Flux<WebSocketMessage> receive() {
        return webSocketSession.receive().handle(this::relay);
    }

    @Override
    public Mono<Void> send(Publisher<WebSocketMessage> messages) {
        Flux<WebSocketMessage> errors = errorsToClient.asFlux();
        Flux<WebSocketMessage> merged = Flux.merge(messages, errors);
        return webSocketSession.send(merged);
    }

    /**
     * A frame that is not forwarded is simply not emitted and never released here: Reactor Netty
     * releases every received frame once {@code onNext} returns, so an explicit release would be a
     * double one and would close the connection with a refCnt error.
     */
    private void relay(WebSocketMessage message, SynchronousSink<WebSocketMessage> sink) {
        if (rejected) {
            return;
        }
        if (!isInspected(message)) {
            sink.next(message);
            return;
        }
        currentFrameType = message.getType();
        byte[] frame = bytesOf(message);
        boolean enforce = properties.isEnforce();
        byte[] forwarded;
        try {
            forwarded = streamFilter.filter(frame, enforce);
        } catch (NatsStreamRejectedException e) {
            reject(e);
            return;
        }
        emit(message, frame, forwarded, sink);
    }

    private boolean isInspected(WebSocketMessage message) {
        if (relayUnfiltered) {
            return false;
        }
        if (!properties.isEnabled()) {
            relayUnfiltered = true;
            return false;
        }
        Type type = message.getType();
        return type == Type.TEXT || type == Type.BINARY;
    }

    private static byte[] bytesOf(WebSocketMessage message) {
        DataBuffer payload = message.getPayload();
        byte[] bytes = new byte[payload.readableByteCount()];
        payload.toByteBuffer(ByteBuffer.wrap(bytes));
        return bytes;
    }

    private void emit(WebSocketMessage message, byte[] frame, byte[] forwarded, SynchronousSink<WebSocketMessage> sink) {
        if (Arrays.equals(frame, forwarded)) {
            sink.next(message);
            return;
        }
        if (forwarded.length == 0) {
            return;
        }
        WebSocketMessage rewritten = messageOf(forwarded);
        sink.next(rewritten);
    }

    private WebSocketMessage messageOf(byte[] bytes) {
        DataBuffer payload = bufferFactory().wrap(bytes);
        return new WebSocketMessage(currentFrameType, payload);
    }

    private void reject(NatsStreamRejectedException cause) {
        rejected = true;
        log.warn("NATS client session closed: {} kind={} id={} path={} tenant={}",
                cause.getMessage(), identity.kind(), identity.id(), path, tenant);
        webSocketSession.close(CloseStatus.POLICY_VIOLATION).subscribe();
    }

    private void onViolation(NatsViolation violation) {
        boolean enforce = properties.isEnforce();
        String operation = violation.operation();
        String kind = identity.kind().name();
        logRefusal(operation, enforce, violation.detail(), kind);
        gatewayTrafficMetrics.recordNatsCommandRefused(operation, kind, enforce);
        if (enforce && isSubjectOperation(operation)) {
            answerPermissionsViolation(operation, violation.detail());
        }
    }

    private void logRefusal(String operation, boolean enforce, String detail, String kind) {
        if (loggedRefusals >= LOGGED_REFUSALS_PER_SESSION) {
            return;
        }
        loggedRefusals++;
        String outcome = outcomeOf(operation, enforce);
        log.warn("NATS client {} not allowed, {}: {} kind={} id={} path={} tenant={}",
                operation, outcome, detail, kind, identity.id(), path, tenant);
    }

    private void answerPermissionsViolation(String operation, String subject) {
        String template = NatsClientStreamFilter.OPERATION_SUB.equals(operation) ? SUBSCRIBE_ERROR : PUBLISH_ERROR;
        String error = String.format(template, subject);
        byte[] bytes = error.getBytes(UTF_8);
        WebSocketMessage message = messageOf(bytes);
        errorsToClient.tryEmitNext(message);
    }

    private static String outcomeOf(String operation, boolean enforce) {
        if (!enforce) {
            return "relayed (enforce=false)";
        }
        if (isSubjectOperation(operation)) {
            return "dropped and answered with -ERR";
        }
        return "closing";
    }

    private static boolean isSubjectOperation(String operation) {
        return !NatsClientStreamFilter.OPERATION_CONNECT.equals(operation)
                && !NatsClientStreamFilter.OPERATION_PROTOCOL.equals(operation);
    }

    @Override
    public String getId() {
        return webSocketSession.getId();
    }

    @Override
    public HandshakeInfo getHandshakeInfo() {
        return webSocketSession.getHandshakeInfo();
    }

    @Override
    public DataBufferFactory bufferFactory() {
        return webSocketSession.bufferFactory();
    }

    @Override
    public Map<String, Object> getAttributes() {
        return webSocketSession.getAttributes();
    }

    @Override
    public boolean isOpen() {
        return webSocketSession.isOpen();
    }

    @Override
    public Mono<Void> close() {
        return webSocketSession.close();
    }

    @Override
    public Mono<Void> close(CloseStatus status) {
        return webSocketSession.close(status);
    }

    @Override
    public Mono<CloseStatus> closeStatus() {
        return webSocketSession.closeStatus();
    }

    @Override
    public WebSocketMessage textMessage(String payload) {
        return webSocketSession.textMessage(payload);
    }

    @Override
    public WebSocketMessage binaryMessage(Function<DataBufferFactory, DataBuffer> payloadFactory) {
        return webSocketSession.binaryMessage(payloadFactory);
    }

    @Override
    public WebSocketMessage pingMessage(Function<DataBufferFactory, DataBuffer> payloadFactory) {
        return webSocketSession.pingMessage(payloadFactory);
    }

    @Override
    public WebSocketMessage pongMessage(Function<DataBufferFactory, DataBuffer> payloadFactory) {
        return webSocketSession.pongMessage(payloadFactory);
    }
}
