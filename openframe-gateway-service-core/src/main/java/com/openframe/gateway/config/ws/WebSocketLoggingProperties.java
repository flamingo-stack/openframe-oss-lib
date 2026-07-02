package com.openframe.gateway.config.ws;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

@Data
@Component
@ConfigurationProperties(prefix = "openframe.gateway.websocket.logging")
public class WebSocketLoggingProperties {

    private List<String> debugPathPrefixes = List.of("/ws/");
    private List<String> framePathPrefixes = List.of();

    private boolean framePayloadLoggingEnabled = false;

    private int maxLoggedPayloadChars = 1024;

    /**
     * When true, non-TEXT (BINARY/PING/PONG) frame payloads are hex-rendered, capped at
     * {@link #maxLoggedPayloadChars} hex characters. OFF by default; needed to see binary tool
     * protocols such as MeshCentral's agent.ashx tunnel. Can be high volume — keep the cap sane.
     */
    private boolean logBinaryPayload = false;

    public boolean isDebugPath(String path) {
        if (path == null || debugPathPrefixes == null) {
            return false;
        }
        return debugPathPrefixes.stream().anyMatch(path::startsWith);
    }

    public boolean isFramePath(String path) {
        if (!framePayloadLoggingEnabled || path == null) {
            return false;
        }
        List<String> prefixes = (framePathPrefixes == null || framePathPrefixes.isEmpty())
                ? debugPathPrefixes : framePathPrefixes;
        return prefixes != null && prefixes.stream().anyMatch(path::startsWith);
    }
}
