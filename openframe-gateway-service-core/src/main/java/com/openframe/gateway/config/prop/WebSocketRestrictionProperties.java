package com.openframe.gateway.config.prop;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Data
@Component
@ConfigurationProperties(prefix = "openframe.gateway.ws-restriction")
public class WebSocketRestrictionProperties {

    private boolean enabled = false;

    /**
     * Hosts for which WebSocket endpoints (/ws/tools/**, /ws/nats, /ws/nats-api) are blocked.
     * Matching is performed against the Host header (port is stripped before comparison).
     */
    private List<String> restrictedHosts = new ArrayList<>();
}
