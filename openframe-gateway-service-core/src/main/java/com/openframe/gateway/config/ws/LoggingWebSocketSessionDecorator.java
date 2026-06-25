package com.openframe.gateway.config.ws;

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

import java.util.Map;
import java.util.function.Function;

/**
 * Taps the relayed WebSocket frames for debug logging without consuming the payload buffers.
 * Applied to the upstream (MeshCentral) session: {@link #receive()} carries frames FROM the
 * upstream ("Mesh responses"), {@link #send(Publisher)} carries frames TO the upstream.
 * <p>
 * IMPORTANT: {@code getPayloadAsText()} and {@code getPayload().readableByteCount()} do NOT move
 * the Netty buffer reader index and do NOT release it, so the same message still relays
 * downstream intact. Never call a consuming/releasing read here.
 * <p>
 * Spring Framework 6.1's reactive stack does not ship a public {@code WebSocketSessionDecorator}
 * (unlike the servlet stack), so this delegates to the wrapped {@link WebSocketSession} explicitly
 * and only overrides {@link #receive()} / {@link #send(Publisher)} to tap the frames.
 */
@Slf4j
public class LoggingWebSocketSessionDecorator implements WebSocketSession {

    private final WebSocketSession webSocketSession;
    private final String logPath;
    private final String tenant;
    private final WebSocketLoggingProperties props;

    public LoggingWebSocketSessionDecorator(WebSocketSession webSocketSession, String logPath, String tenant,
                                            WebSocketLoggingProperties props) {
        this.webSocketSession = webSocketSession;
        this.logPath = logPath;
        this.tenant = tenant == null ? "-" : tenant;
        this.props = props;
    }

    @Override
    public Flux<WebSocketMessage> receive() {
        return webSocketSession.receive()
                .doOnNext(message -> logFrame("upstream->gw", message))
                .doOnError(e -> log.debug("Debug ws frame upstream->gw stream error sessionId={} path={} tenant={} : {}",
                        getId(), logPath, tenant, e.toString()));
    }

    @Override
    public Mono<Void> send(Publisher<WebSocketMessage> messages) {
        return webSocketSession.send(Flux.from(messages)
                .doOnNext(message -> logFrame("gw->upstream", message)));
    }

    private void logFrame(String direction, WebSocketMessage message) {
        if (!log.isDebugEnabled()) {
            return;
        }
        try {
            Type type = message.getType();
            int bytes = message.getPayload().readableByteCount();
            if (type == Type.TEXT) {
                String shown = truncate(message.getPayloadAsText(), props.getMaxLoggedPayloadChars());
                log.debug("Debug ws frame {} sessionId={} path={} tenant={} type={} bytes={} payload={}",
                        direction, getId(), logPath, tenant, type, bytes, shown);
            } else {
                log.debug("Debug ws frame {} sessionId={} path={} tenant={} type={} bytes={}",
                        direction, getId(), logPath, tenant, type, bytes);
            }
        } catch (Exception e) {
            // Logging is best-effort and must never disrupt the proxied stream.
            log.debug("Debug ws frame {} sessionId={} path={} : log tap failed: {}",
                    direction, getId(), logPath, e.toString());
        }
    }

    /**
     * Renders the payload for the log line, appending a {@code ...(N chars)} suffix with the full
     * length when the text exceeds {@code maxChars}; returns it unchanged when {@code maxChars <= 0}
     * or it fits.
     */
    static String truncate(String text, int maxChars) {
        return (maxChars > 0 && text.length() > maxChars)
                ? text.substring(0, maxChars) + "...(" + text.length() + " chars)"
                : text;
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
