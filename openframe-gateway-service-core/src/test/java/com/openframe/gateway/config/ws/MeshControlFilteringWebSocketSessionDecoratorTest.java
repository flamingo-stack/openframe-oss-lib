package com.openframe.gateway.config.ws;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.buffer.DefaultDataBufferFactory;
import org.springframework.web.reactive.socket.WebSocketMessage;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.publisher.Flux;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MeshControlFilteringWebSocketSessionDecoratorTest {

    private static final DefaultDataBufferFactory BUFFERS = new DefaultDataBufferFactory();
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Test
    void relaysAllowedCommandsAndDropsTheRest() {
        MeshControlCommandProperties props = enforcing();

        List<String> relayed = filter(props,
                json("ping"),
                json("authcookie"),
                json("getpluginpermissionlist"),
                json("changeuserpass"),
                json("serverconsole"),
                json("msg"));

        assertThat(relayed).containsExactly(json("ping"), json("authcookie"), json("msg"));
    }

    @Test
    void relaysEverythingWhenNotEnforcing() {
        MeshControlCommandProperties props = enforcing();
        props.setEnforce(false);

        List<String> relayed = filter(props, json("ping"), json("changeuserpass"));

        assertThat(relayed).containsExactly(json("ping"), json("changeuserpass"));
    }

    @Test
    void dropsFramesThatAreNotJsonCommandsWhenEnforcing() {
        MeshControlCommandProperties props = enforcing();

        assertThat(filter(props, "not json at all")).isEmpty();
        // Valid JSON, but no action to vet.
        assertThat(filter(props, "{\"nodeid\":\"node/x/y\"}")).isEmpty();
    }

    @Test
    void controlPathMatchingIgnoresQueryStringAndOtherChannels() {
        MeshControlCommandProperties props = enforcing();

        assertThat(props.isControlPath("/ws/tools/meshcentral-server/control.ashx")).isTrue();
        assertThat(props.isControlPath("/ws/tools/meshcentral-server/control.ashx?user=a&pass=b")).isTrue();
        // The tunnels the file manager, desktop and terminal use must stay untouched.
        assertThat(props.isControlPath("/ws/tools/meshcentral-server/meshrelay.ashx")).isFalse();
        assertThat(props.isControlPath("/ws/tools/agent/meshcentral-server/agent.ashx")).isFalse();
    }

    @Test
    void isOffByDefault() {
        assertThat(new MeshControlCommandProperties().isEnabled()).isFalse();
    }

    @Test
    void relaysEverythingWhenDisabled() {
        // The switch is the rollback control, so it has to hold on a session that is already open
        // and filtering — not just prevent new sessions from being wrapped.
        MeshControlCommandProperties props = enforcing();
        props.setEnabled(false);

        assertThat(filter(props, json("ping"), json("changeuserpass"), json("serverconsole")))
                .containsExactly(json("ping"), json("changeuserpass"), json("serverconsole"));
    }

    private static MeshControlCommandProperties enforcing() {
        MeshControlCommandProperties props = new MeshControlCommandProperties();
        props.setEnabled(true);
        props.setEnforce(true);
        return props;
    }

    private static String json(String action) {
        return "{\"action\":\"" + action + "\"}";
    }

    private static List<String> filter(MeshControlCommandProperties props, String... payloads) {
        WebSocketSession delegate = mock(WebSocketSession.class);
        when(delegate.receive()).thenReturn(Flux.fromArray(payloads).map(MeshControlFilteringWebSocketSessionDecoratorTest::textMessage));

        MeshControlFilteringWebSocketSessionDecorator decorator =
                new MeshControlFilteringWebSocketSessionDecorator(delegate, "/ws/tools/meshcentral-server/control.ashx",
                        "tenant-1", props, MAPPER);

        return decorator.receive().map(WebSocketMessage::getPayloadAsText).collectList().block();
    }

    private static WebSocketMessage textMessage(String payload) {
        return new WebSocketMessage(WebSocketMessage.Type.TEXT,
                BUFFERS.wrap(payload.getBytes(StandardCharsets.UTF_8)));
    }
}
