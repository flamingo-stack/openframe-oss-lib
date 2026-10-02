package com.openframe.gateway.config.ws;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

import java.util.Map;
import java.util.function.Function;

/**
 * Drops MeshCentral control-channel commands that are not on the allowlist.
 * <p>
 * Applied to the client-side session, so {@link #receive()} is the browser &rarr; MeshCentral
 * direction — the only one a user controls. Responses ({@link #send}) are relayed untouched.
 * <p>
 * A dropped frame is simply not forwarded; MeshCentral never sees it and therefore never answers,
 * which is how it already behaves for a command a user lacks rights for. The buffer of a dropped
 * frame must be released explicitly — nothing downstream will do it once the message leaves the
 * stream.
 *
 * @see MeshControlCommandProperties
 */
@Slf4j
public class MeshControlFilteringWebSocketSessionDecorator implements WebSocketSession {

    private final WebSocketSession webSocketSession;
    private final String path;
    private final String tenant;
    private final MeshControlCommandProperties props;
    private final ObjectMapper objectMapper;

    public MeshControlFilteringWebSocketSessionDecorator(WebSocketSession webSocketSession, String path, String tenant,
                                                         MeshControlCommandProperties props, ObjectMapper objectMapper) {
        this.webSocketSession = webSocketSession;
        this.path = path;
        this.tenant = tenant == null ? "-" : tenant;
        this.props = props;
        this.objectMapper = objectMapper;
    }

    @Override
    public Flux<WebSocketMessage> receive() {
        return webSocketSession.receive().filter(this::relay);
    }

    @Override
    public Mono<Void> send(Publisher<WebSocketMessage> messages) {
        return webSocketSession.send(messages);
    }

    /**
     * @return true to relay the frame, false to drop it (releasing its payload first).
     */
    private boolean relay(WebSocketMessage message) {
        // Re-read the switch per frame rather than trusting the decision made when the session was
        // wrapped: this is the rollback control, and flipping it off must take effect on sessions
        // that are already open, not only on new ones. It also means the filter is inert if it is
        // ever constructed from somewhere that did not check.
        if (!props.isEnabled()) {
            return true;
        }
        // Only the JSON command channel is inspected. Binary frames on this path are protocol
        // framing rather than commands, and blocking them would break the session rather than a
        // command; PING/PONG are keepalive.
        if (message.getType() != Type.TEXT) {
            return true;
        }
        String action;
        try {
            // getPayloadAsText() neither advances the reader index nor releases the buffer, so the
            // relayed message stays intact.
            JsonNode node = objectMapper.readTree(message.getPayloadAsText());
            JsonNode actionNode = node.get("action");
            action = (actionNode != null && actionNode.isTextual()) ? actionNode.asText() : null;
        } catch (Exception e) {
            // Not JSON, or unparseable. Fail closed when enforcing: everything the frontend sends on
            // this channel is JSON with an action, so anything else is not a command we know how to
            // vet.
            log.warn("Mesh control frame is not a JSON command, {} path={} tenant={} : {}",
                    props.isEnforce() ? "dropping" : "relaying", path, tenant, e.toString());
            return dropOrRelay(message);
        }
        if (props.isAllowedAction(action)) {
            return true;
        }
        log.warn("Mesh control command not allowed, {} action={} path={} tenant={}",
                props.isEnforce() ? "dropped" : "relayed (enforce=false)", action, path, tenant);
        return dropOrRelay(message);
    }

    private boolean dropOrRelay(WebSocketMessage message) {
        if (!props.isEnforce()) {
            return true;
        }
        DataBufferUtils.release(message.getPayload());
        return false;
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
