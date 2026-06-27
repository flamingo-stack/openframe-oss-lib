package com.openframe.gateway.config.ws;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class WebSocketLoggingPropertiesTest {

    @Test
    void shouldReturnFalseFromIsFramePathWhenFramePayloadLoggingDisabled() {
        // Arrange
        WebSocketLoggingProperties props = new WebSocketLoggingProperties();
        props.setFramePayloadLoggingEnabled(false);
        props.setFramePathPrefixes(List.of("/ws/tools/agent/meshcentral-server/"));

        // Act / Assert
        assertThat(props.isFramePath("/ws/tools/agent/meshcentral-server/agent.ashx")).isFalse();
    }

    @Test
    void shouldReturnTrueFromIsFramePathOnlyForConfiguredPrefixWhenEnabled() {
        // Arrange
        WebSocketLoggingProperties props = new WebSocketLoggingProperties();
        props.setFramePayloadLoggingEnabled(true);
        props.setFramePathPrefixes(List.of("/ws/tools/agent/meshcentral-server/"));

        // Act / Assert
        assertThat(props.isFramePath("/ws/tools/agent/meshcentral-server/agent.ashx")).isTrue();
        assertThat(props.isFramePath("/ws/nats")).isFalse();
        assertThat(props.isFramePath(null)).isFalse();
    }

    @Test
    void shouldFallBackToDebugPathPrefixesWhenFramePathPrefixesEmpty() {
        // Arrange
        WebSocketLoggingProperties props = new WebSocketLoggingProperties();
        props.setFramePayloadLoggingEnabled(true);
        props.setDebugPathPrefixes(List.of("/ws/"));
        props.setFramePathPrefixes(List.of());

        // Act / Assert
        assertThat(props.isFramePath("/ws/tools/agent/meshcentral-server/agent.ashx")).isTrue();
        assertThat(props.isFramePath("/api/v1/health")).isFalse();
    }
}
