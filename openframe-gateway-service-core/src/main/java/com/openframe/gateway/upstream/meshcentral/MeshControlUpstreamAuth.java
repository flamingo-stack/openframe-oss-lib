package com.openframe.gateway.upstream.meshcentral;

import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;
import java.util.Set;
import java.util.stream.Collectors;

import static com.openframe.gateway.config.ws.WebSocketGatewayConfig.TOOLS_API_WS_ENDPOINT_PREFIX;

@Slf4j
@Component
public class MeshControlUpstreamAuth {

    public static final String MESH_AUTH_HEADER = "x-meshauth";

    private static final String TOOL_PATH_PREFIX =
            TOOLS_API_WS_ENDPOINT_PREFIX + "/" + MeshCentralUpstreamResolver.TOOL_ID + "/";
    private static final String CONTROL_ENDPOINT = "control.ashx";
    private static final Set<String> CREDENTIAL_PARAMS = Set.of("user", "pass");
    private static final String PAIR_SEPARATOR = "&";

    private final String headerValue;

    public MeshControlUpstreamAuth(MeshCentralRoutingProperties properties) {
        MeshCentralRoutingProperties.Credentials credentials = properties.getCredentials();
        String username = credentials == null ? null : credentials.getUsername();
        String password = credentials == null ? null : credentials.getPassword();
        boolean hasUsername = StringUtils.isNotBlank(username);
        boolean hasPassword = StringUtils.isNotBlank(password);
        if (hasUsername != hasPassword) {
            throw new IllegalStateException(
                    "openframe.tools.meshcentral.credentials needs both username and password, or neither");
        }
        this.headerValue = hasUsername ? encode(username) + "," + encode(password) : null;
        log.info("MeshCentral control upstream auth: enabled={}", isEnabled());
    }

    public boolean isEnabled() {
        return headerValue != null;
    }

    public boolean appliesTo(String path) {
        return isEnabled() && isControlEndpoint(path);
    }

    public String headerValue() {
        if (!isEnabled()) {
            throw new IllegalStateException("MeshCentral control upstream auth is not configured");
        }
        return headerValue;
    }

    public URI withoutCredentialParams(URI upstream) {
        String rawQuery = upstream.getRawQuery();
        if (rawQuery == null) {
            return upstream;
        }
        String[] pairs = rawQuery.split(PAIR_SEPARATOR);
        String keptQuery = Arrays.stream(pairs)
                .filter(pair -> !isCredentialPair(pair))
                .collect(Collectors.joining(PAIR_SEPARATOR));
        if (keptQuery.equals(rawQuery)) {
            return upstream;
        }
        String rebuilt = withQuery(upstream, keptQuery);
        return URI.create(rebuilt);
    }

    private static boolean isControlEndpoint(String path) {
        if (path == null || !path.startsWith(TOOL_PATH_PREFIX)) {
            return false;
        }
        String endpoint = path.substring(TOOL_PATH_PREFIX.length());
        String trimmedEndpoint = StringUtils.stripEnd(endpoint, "/");
        return CONTROL_ENDPOINT.equalsIgnoreCase(trimmedEndpoint);
    }

    private static boolean isCredentialPair(String pair) {
        String rawName = StringUtils.substringBefore(pair, "=");
        String name = URLDecoder.decode(rawName, StandardCharsets.UTF_8);
        String baseName = StringUtils.substringBefore(name, "[");
        return CREDENTIAL_PARAMS.contains(baseName);
    }

    private static String withQuery(URI uri, String query) {
        StringBuilder text = new StringBuilder();
        text.append(uri.getScheme()).append("://");
        if (uri.getRawAuthority() != null) {
            text.append(uri.getRawAuthority());
        }
        if (uri.getRawPath() != null) {
            text.append(uri.getRawPath());
        }
        if (!query.isEmpty()) {
            text.append('?').append(query);
        }
        if (uri.getRawFragment() != null) {
            text.append('#').append(uri.getRawFragment());
        }
        return text.toString();
    }

    private static String encode(String text) {
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        return Base64.getEncoder().encodeToString(bytes);
    }
}
