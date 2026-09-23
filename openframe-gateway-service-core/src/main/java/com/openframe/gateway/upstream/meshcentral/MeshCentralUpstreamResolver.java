package com.openframe.gateway.upstream.meshcentral;

import com.openframe.core.service.ProxyUrlResolver;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.gateway.tenant.TenantRoutingHeaders;
import com.openframe.gateway.upstream.ToolUpstreamResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Optional;

/**
 * MeshCentral-specific routing strategy.
 *
 * Reads upstream addresses from {@link MeshCentralRoutingProperties}, populated
 * from {@code openframe.tools.meshcentral.*} in {@code application.yml}.
 * This avoids a MongoDB lookup on every request (which the
 * {@link com.openframe.gateway.upstream.DefaultToolUpstreamResolver} would do).
 *
 * MeshCentral is a single service on one port — no path-based fan-out needed.
 * Both REST and WebSocket traffic go to the same host, just with different
 * URL schemes (http vs ws).
 */
@Component
@RequiredArgsConstructor
public class MeshCentralUpstreamResolver implements ToolUpstreamResolver {

    public static final String TOOL_ID = "meshcentral-server";

    private final MeshCentralRoutingProperties props;
    private final ProxyUrlResolver proxyUrlResolver;

    /**
     * Multi-tenant routing mode. When true the trusted {@code X-Tenant-Ns}/{@code X-Tenant-Id} headers
     * are guaranteed by the upstream tenant-context enforcement and drive the namespace/path-prefix
     * rewrites; when false (single-tenant pods) headers are never read and the configured values are
     * used verbatim.
     */
    @Value("${openframe.gateway.tenant-routing.enabled:false}")
    private boolean tenantRoutingEnabled;

    @Override
    public Optional<String> supportsToolId() {
        return Optional.of(TOOL_ID);
    }

    @Override
    public URI resolveRest(IntegratedTool tool, ServerHttpRequest request, String stripPrefix) {
        return build(props.getApi(), request, stripPrefix);
    }

    @Override
    public URI resolveWs(IntegratedTool tool, ServerHttpRequest request, String stripPrefix) {
        return build(props.getWebsocket(), request, stripPrefix);
    }

    private URI build(MeshCentralRoutingProperties.Upstream upstream,
                      ServerHttpRequest request, String stripPrefix) {
        URI resolved = proxyUrlResolver.resolve(
                TOOL_ID, upstream.getUrl(), upstream.getPort(), request.getURI(), stripPrefix);
        if (!tenantRoutingEnabled) {
            // Single-tenant pod: configured host and path-prefix are already final.
            return prependPathPrefix(resolved, upstream.getPathPrefix());
        }
        // Multi-tenant pod: rewrite the host namespace placeholder and the path-prefix tenant-uuid
        // placeholder for the calling tenant (headers guaranteed by upstream enforcement).
        resolved = TenantRoutingHeaders.applyToUri(resolved, TenantRoutingHeaders.tenantNamespace(request));
        return prependPathPrefix(resolved, resolveTenantPathPrefix(upstream.getPathPrefix(), request));
    }

    /**
     * Substitute the {@code tenant-uuid} placeholder token in the configured path-prefix with the
     * per-request tenant id. Multi-tenant mode only — the {@code X-Tenant-Id} header is guaranteed.
     */
    private static String resolveTenantPathPrefix(String pathPrefix, ServerHttpRequest request) {
        if (pathPrefix == null) {
            return null;
        }
        return pathPrefix.replace(TenantRoutingHeaders.TENANT_UUID_PLACEHOLDER, TenantRoutingHeaders.tenantId(request));
    }

    private URI prependPathPrefix(URI uri, String pathPrefix) {
        if (pathPrefix == null || pathPrefix.isEmpty() || "/".equals(pathPrefix)) {
            return uri;
        }
        String prefix = pathPrefix.startsWith("/") ? pathPrefix : "/" + pathPrefix;
        if (prefix.endsWith("/")) {
            prefix = prefix.substring(0, prefix.length() - 1);
        }
        String existingPath = uri.getRawPath() == null ? "" : uri.getRawPath();
        // Skip when the path is already scoped to the tenant. Mesh's relay
        // logic embeds the domain in tunnel URLs it hands to the agent
        // (`*/<domain>/meshrelay.ashx`), so the agent's dial arrives already
        // prefixed — adding the prefix again would produce /<domain>/<domain>/.
        if (existingPath.equals(prefix) || existingPath.startsWith(prefix + "/")) {
            return uri;
        }
        return withPath(uri, prefix + existingPath);
    }

    /**
     * Rebuild {@code uri} with a new path, preserving every other component
     * verbatim from its raw form.
     * <p>
     * We deliberately avoid {@link org.springframework.web.util.UriComponentsBuilder}'s
     * {@code build(true)} here — its strict {@code QUERY_PARAM} validation
     * rejects '=' in query values (e.g. base64 padding in mesh auth cookies),
     * which would crash the resolver on every WS request. Concatenating the
     * already-encoded raw components and letting {@link URI#URI(String, String, String, int, String, String, String)}
     * multi-argument constructor recompose them keeps the raw query/fragment
     * intact (no re-encoding of already-percent-encoded '=' etc.) while still
     * validating scheme/host/authority structure, unlike parsing a
     * hand-concatenated string with {@link URI#URI(String)}.
     */
    private URI withPath(URI uri, String newPath) {
        try {
            return new URI(uri.getScheme(), uri.getRawAuthority(), newPath, uri.getRawQuery(), uri.getRawFragment());
        } catch (URISyntaxException e) {
            throw new IllegalStateException("Failed to build mesh upstream URI", e);
        }
    }
}
