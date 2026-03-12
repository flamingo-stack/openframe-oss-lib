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

    public boolean isDebugPath(String path) {
        if (path == null || debugPathPrefixes == null) {
            return false;
        }
        return debugPathPrefixes.stream().anyMatch(path::startsWith);
    }
}
