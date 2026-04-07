package com.openframe.gateway.upstream;

import com.openframe.data.document.tool.IntegratedTool;
import org.springframework.http.server.reactive.ServerHttpRequest;

import java.net.URI;
import java.util.Optional;

/**
 * Strategy that decides where a proxied request to an integrated tool should land.
 *
 * One implementation per "routing style":
 * - {@link DefaultToolUpstreamResolver} reads the URL from the {@link IntegratedTool}
 *   Mongo document via {@code ToolUrlType.API} / {@code ToolUrlType.WS}. Used by every
 *   tool that does not have a dedicated resolver bean.
 * - Tool-specific resolvers (e.g. {@code TacticalRmmUpstreamResolver}) read URLs from
 *   typed configuration properties and may fan out by request path.
 *
 * Add a new specially-routed tool by creating a new {@code @Component} implementing
 * this interface and returning the toolId from {@link #supportsToolId()}. Spring will
 * pick it up automatically; no other code needs to change.
 */
public interface ToolUpstreamResolver {

    /**
     * The toolId this resolver handles, or {@link Optional#empty()} for the default
     * fallback resolver. Exactly one resolver must return {@code Optional.empty()}.
     */
    Optional<String> supportsToolId();

    /**
     * Build the target URI for a REST (or REST-style agent) request.
     *
     * @param tool         the loaded {@link IntegratedTool} document
     * @param request      the original incoming request
     * @param stripPrefix  the path prefix to strip when computing the upstream path
     *                     (e.g. {@code /tools} or {@code /tools/agent})
     */
    URI resolveRest(IntegratedTool tool, ServerHttpRequest request, String stripPrefix);

    /**
     * Build the target URI for a WebSocket request.
     *
     * @param tool         the loaded {@link IntegratedTool} document
     * @param request      the original incoming request
     * @param stripPrefix  the path prefix to strip when computing the upstream path
     */
    URI resolveWs(IntegratedTool tool, ServerHttpRequest request, String stripPrefix);
}
