package com.openframe.gateway.config.ws;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.web.reactive.socket.WebSocketSession;
import org.springframework.web.server.ServerWebExchange;

@Getter
@AllArgsConstructor
public class SecuredWebSocket {

    private final ServerWebExchange exchange;
    private final WebSocketSession session;
    private final String path;
    private final String sub;
    private final boolean debugPath;

    public String getSessionId() {
        return session.getId();
    }
}
