package com.openframe.gateway.config.ws;

import com.openframe.gateway.metrics.GatewayTrafficMetrics;
import lombok.extern.slf4j.Slf4j;
import org.reactivestreams.Publisher;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.core.io.buffer.DataBufferFactory;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.web.reactive.socket.CloseStatus;
import org.springframework.web.reactive.socket.HandshakeInfo;
import org.springframework.web.reactive.socket.WebSocketMessage;
import org.springframework.web.reactive.socket.WebSocketMessage.Type;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
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
 * the only one a client controls; NATS &rarr; client ({@link #send}) is relayed untouched. The
 * protocol work is in {@link NatsClientStreamFilter}; this decorator turns frames into bytes and
 * back, and ends the session when the filter says so.
 * <p>
 * The parser keeps state across frames, so once a session relays unfiltered it stays that way:
 * switching the filter off takes effect on open sessions at once, switching it on only on new ones.
 *
 * @see NatsSubjectFilterProperties
 */
@Slf4j
public class NatsSubjectFilteringWebSocketSessionDecorator implements WebSocketSession {

    private final WebSocketSession webSocketSession;
    private final String path;
    private final String tenant;
    private final NatsClientIdentity identity;
    private final NatsSubjectFilterProperties properties;
    private final GatewayTrafficMetrics gatewayTrafficMetrics;
    private final NatsClientStreamFilter streamFilter;

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
        return webSocketSession.send(messages);
    }

    private void relay(WebSocketMessage message, SynchronousSink<WebSocketMessage> sink) {
        if (rejected) {
            DataBufferUtils.release(message.getPayload());
            return;
        }
        if (!isInspected(message)) {
            sink.next(message);
            return;
        }
        byte[] frame = bytesOf(message);
        boolean enforce = properties.isEnforce();
        byte[] forwarded;
        try {
            forwarded = streamFilter.filter(frame, enforce);
        } catch (NatsStreamRejectedException e) {
            reject(message, e);
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
        Type type = message.getType();
        DataBufferUtils.release(message.getPayload());
        if (forwarded.length == 0) {
            return;
        }
        WebSocketMessage rewritten = messageOf(type, forwarded);
        sink.next(rewritten);
    }

    private WebSocketMessage messageOf(Type type, byte[] bytes) {
        DataBuffer payload = bufferFactory().wrap(bytes);
        return new WebSocketMessage(type, payload);
    }

    private void reject(WebSocketMessage message, NatsStreamRejectedException cause) {
        rejected = true;
        DataBufferUtils.release(message.getPayload());
        log.warn("NATS client session closed: {} kind={} id={} path={} tenant={}",
                cause.getMessage(), identity.kind(), identity.id(), path, tenant);
        webSocketSession.close(CloseStatus.POLICY_VIOLATION).subscribe();
    }

    private void onViolation(NatsViolation violation) {
        boolean enforce = properties.isEnforce();
        String operation = violation.operation();
        String outcome = outcomeOf(operation, enforce);
        String kind = identity.kind().name();
        log.warn("NATS client {} not allowed, {}: {} kind={} id={} path={} tenant={}",
                operation, outcome, violation.detail(), kind, identity.id(), path, tenant);
        gatewayTrafficMetrics.recordNatsCommandRefused(operation, kind, enforce);
    }

    private static String outcomeOf(String operation, boolean enforce) {
        if (!enforce) {
            return "relayed (enforce=false)";
        }
        if (isSubjectOperation(operation)) {
            return "subject prefixed with " + NatsClientStreamFilter.DENIED_SUBJECT_PREFIX;
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
