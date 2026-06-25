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
 * Applied to the client (agent &harr; gateway) session, where the original request path is known:
 * {@link #receive()} carries frames the client sends toward the upstream tool, and
 * {@link #send(Publisher)} carries the upstream tool's responses back to the client (the
 * "Mesh responses" when proxying MeshCentral).
 * <p>
 * IMPORTANT: {@code getPayloadAsText()} and {@code getPayload().readableByteCount()} do NOT move
 * the Netty buffer reader index and do NOT release it, so the same message still relays intact.
 * Never call a consuming/releasing read here.
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
                .doOnNext(message -> logFrame("client->gw", message))
                .doOnError(e -> log.debug("Debug ws frame client->gw stream error sessionId={} path={} tenant={} : {}",
                        getId(), logPath, tenant, e.toString()));
    }

    @Override
    public Mono<Void> send(Publisher<WebSocketMessage> messages) {
        return webSocketSession.send(Flux.from(messages)
                .doOnNext(message -> logFrame("gw->client", message)));
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
            } else if (props.isLogBinaryPayload()) {
                String shown = toPrintablePreview(message.getPayload(), props.getMaxLoggedPayloadChars());
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

    /**
     * Renders up to {@code maxChars} bytes of a binary payload as printable text WITHOUT consuming it:
     * printable ASCII (0x20–0x7E) is kept verbatim, every other byte becomes {@code '.'}. This makes the
     * many "binary" frames that are really JSON or ASCII (e.g. MeshCentral's command and {@code {"action":…}}
     * frames) readable, while genuine binary (certs/nonces) degrades to dots. Absolute
     * {@link DataBuffer#getByte(int)} reads do not move the reader index or release the buffer, so the same
     * message still relays intact. Appends a {@code …(N bytes total)} suffix (deliberately the ellipsis
     * char, so it stands out from the {@code '.'} placeholders) when truncated; {@code maxChars <= 0}
     * renders the whole payload. Package-private static for unit testing.
     */
    static String toPrintablePreview(DataBuffer payload, int maxChars) {
        int total = payload.readableByteCount();
        int count = maxChars > 0 ? Math.min(total, maxChars) : total;
        int start = payload.readPosition();
        StringBuilder sb = new StringBuilder(count + 16);
        for (int i = 0; i < count; i++) {
            int b = payload.getByte(start + i) & 0xFF;
            sb.append(b >= 0x20 && b < 0x7F ? (char) b : '.');
        }
        if (count < total) {
            sb.append("…(").append(total).append(" bytes total)");
        }
        return sb.toString();
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
