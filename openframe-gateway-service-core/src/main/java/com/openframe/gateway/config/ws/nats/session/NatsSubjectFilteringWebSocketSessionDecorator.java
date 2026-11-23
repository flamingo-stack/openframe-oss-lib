package com.openframe.gateway.config.ws.nats.session;

import com.openframe.gateway.config.ws.nats.NatsClientContext;
import com.openframe.gateway.config.ws.nats.NatsSubjectFilterProperties;
import com.openframe.gateway.config.ws.nats.check.NatsCommandVetter;
import com.openframe.gateway.config.ws.nats.check.NatsVerdict;
import com.openframe.gateway.config.ws.nats.protocol.NatsClientCommand;
import com.openframe.gateway.config.ws.nats.protocol.NatsClientStreamAssembler;
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

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/**
 * Vets what a NATS websocket client sends against who the client is.
 * <p>
 * Applied to the client-side session, so {@link #receive()} is the client &rarr; NATS direction —
 * the only one a client controls. NATS &rarr; client ({@link #send}) is relayed untouched, except
 * that the {@code -ERR} for a refused command is merged into it. The frames are assembled into
 * commands by {@link NatsClientStreamAssembler}, judged by {@link NatsCommandVetter}, and relayed
 * in order: a command whose check reads the database holds the ones behind it until it is decided.
 * <p>
 * Every inbound frame is copied out as soon as it arrives: Reactor Netty releases a received frame
 * once {@code onNext} returns, and the decision about it may come later, so nothing here keeps or
 * releases the original buffer. Once a session relays unfiltered it stays that way: switching the
 * filter off takes effect on open sessions at once, switching it on only on new ones.
 *
 * @see NatsSubjectFilterProperties
 */
@Slf4j
public class NatsSubjectFilteringWebSocketSessionDecorator implements WebSocketSession {

    private static final byte[] NOTHING = new byte[0];

    private final WebSocketSession webSocketSession;
    private final NatsClientContext context;
    private final NatsSubjectFilterProperties properties;
    private final NatsClientStreamAssembler assembler;
    private final NatsCommandVetter vetter;
    private final NatsRefusalReporter reporter;
    private final Sinks.Many<WebSocketMessage> errorsToClient = Sinks.many().unicast().onBackpressureBuffer();

    private Type currentFrameType = Type.BINARY;
    private boolean relayUnfiltered;
    private boolean rejected;

    public NatsSubjectFilteringWebSocketSessionDecorator(WebSocketSession webSocketSession, NatsClientContext context,
                                                         NatsSubjectFilterProperties properties,
                                                         NatsClientStreamAssembler assembler, NatsCommandVetter vetter,
                                                         NatsRefusalReporter reporter) {
        this.webSocketSession = webSocketSession;
        this.context = context;
        this.properties = properties;
        this.assembler = assembler;
        this.vetter = vetter;
        this.reporter = reporter;
    }

    @Override
    public Flux<WebSocketMessage> receive() {
        return webSocketSession.receive()
                .map(CapturedFrame::of)
                .concatMap(this::relay);
    }

    @Override
    public Mono<Void> send(Publisher<WebSocketMessage> messages) {
        Flux<WebSocketMessage> errors = errorsToClient.asFlux();
        Flux<WebSocketMessage> merged = Flux.merge(messages, errors);
        return webSocketSession.send(merged);
    }

    private Mono<WebSocketMessage> relay(CapturedFrame frame) {
        if (rejected) {
            return Mono.empty();
        }
        if (!isInspected(frame)) {
            return Mono.just(messageOf(frame.type(), frame.bytes()));
        }
        currentFrameType = frame.type();
        List<NatsClientCommand> commands = assembler.feed(frame.bytes());
        return Flux.fromIterable(commands)
                .concatMap(this::forwardable)
                .collect(ByteArrayOutputStream::new, ByteArrayOutputStream::writeBytes)
                .map(ByteArrayOutputStream::toByteArray)
                .filter(bytes -> bytes.length > 0)
                .map(bytes -> messageOf(frame.type(), bytes));
    }

    private boolean isInspected(CapturedFrame frame) {
        if (relayUnfiltered) {
            return false;
        }
        if (!properties.isEnabled()) {
            relayUnfiltered = true;
            return false;
        }
        return frame.type() == Type.TEXT || frame.type() == Type.BINARY;
    }

    private Mono<byte[]> forwardable(NatsClientCommand command) {
        if (rejected) {
            return Mono.just(NOTHING);
        }
        return vetter.vet(command, context)
                .map(verdict -> apply(verdict, command));
    }

    private byte[] apply(NatsVerdict verdict, NatsClientCommand command) {
        boolean enforce = properties.isEnforce();
        return switch (verdict) {
            case NatsVerdict.Allowed allowed -> command.raw();
            case NatsVerdict.Refused refused -> applyRefusal(refused, command, enforce);
            case NatsVerdict.Closed closed -> applyClose(closed, command, enforce);
            case NatsVerdict.ProtocolTrouble trouble -> applyProtocolTrouble(trouble, command, enforce);
        };
    }

    private byte[] applyRefusal(NatsVerdict.Refused refused, NatsClientCommand command, boolean enforce) {
        reporter.refused(refused, enforce);
        if (!enforce) {
            return command.raw();
        }
        byte[] error = NatsPermissionError.of(refused);
        WebSocketMessage message = messageOf(currentFrameType, error);
        errorsToClient.tryEmitNext(message);
        return NOTHING;
    }

    private byte[] applyClose(NatsVerdict.Closed closed, NatsClientCommand command, boolean enforce) {
        reporter.closed(closed, enforce);
        if (!enforce) {
            return command.raw();
        }
        reject(closed.reason());
        return NOTHING;
    }

    private byte[] applyProtocolTrouble(NatsVerdict.ProtocolTrouble trouble, NatsClientCommand command, boolean enforce) {
        reporter.protocolTrouble(trouble, enforce);
        if (enforce) {
            reject(trouble.reason());
            return NOTHING;
        }
        assembler.relayUnparsed();
        return command.raw();
    }

    private void reject(String reason) {
        rejected = true;
        log.warn("NATS client session closed: {} kind={} id={} path={} tenant={}",
                reason, context.kind(), context.clientId(), context.path(), context.tenantId());
        webSocketSession.close(CloseStatus.POLICY_VIOLATION).subscribe();
    }

    private WebSocketMessage messageOf(Type type, byte[] bytes) {
        DataBuffer payload = bufferFactory().wrap(bytes);
        return new WebSocketMessage(type, payload);
    }

    private record CapturedFrame(Type type, byte[] bytes) {

        static CapturedFrame of(WebSocketMessage message) {
            DataBuffer payload = message.getPayload();
            byte[] bytes = new byte[payload.readableByteCount()];
            payload.toByteBuffer(ByteBuffer.wrap(bytes));
            return new CapturedFrame(message.getType(), bytes);
        }
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
