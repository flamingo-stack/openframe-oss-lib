package com.openframe.gateway.config;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import reactor.core.Hooks;
import reactor.netty.channel.AbortedException;

/**
 * Configures Reactor global hooks to suppress expected errors during WebSocket close races.
 *
 * When Reactor Netty's proxy WebSocket client receives a close frame from the upstream,
 * it calls sendCloseNow() internally. If the channel is already closing (e.g. because
 * the handler chain completed and our cleanup logic also initiated a close), the write
 * fails with StacklessClosedChannelException wrapped in AbortedException. Since the
 * reactive chain is already terminated, the error is "dropped" and logged at ERROR level
 * by default. This handler downgrades those expected errors to DEBUG.
 */
@Slf4j
@Configuration
public class ReactorHooksConfig {

    @PostConstruct
    public void configureHooks() {
        Hooks.onErrorDropped(error -> {
            if (isExpectedWebSocketCloseError(error)) {
                log.debug("Suppressed expected WebSocket close error: {}", error.getMessage());
            } else {
                log.error("Operator called default onErrorDropped", error);
            }
        });
    }

    private static boolean isExpectedWebSocketCloseError(Throwable error) {
        Throwable cause = error;
        while (cause != null) {
            if (cause instanceof AbortedException
                    || cause instanceof java.nio.channels.ClosedChannelException) {
                return true;
            }
            cause = cause.getCause();
        }
        return false;
    }
}
