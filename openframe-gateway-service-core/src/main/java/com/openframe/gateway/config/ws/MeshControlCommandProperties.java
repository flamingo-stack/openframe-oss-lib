package com.openframe.gateway.config.ws;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;

/**
 * Allowlist for the MeshCentral control channel ({@code control.ashx}).
 * <p>
 * The browser does not reach MeshCentral directly, but it does hold a full MeshCentral
 * <em>site administrator</em> session through this gateway: the frontend opens control.ashx with the
 * mesh admin credentials, and every logged-in OpenFrame user carries the {@code ADMIN} role that the
 * {@code /ws/tools/**} route requires. Since the gateway relays frames verbatim, any other command in
 * MeshCentral's control protocol is reachable from the browser console — including administrative
 * ones that are not tenant-scoped in MeshCentral itself (fleet-wide listings, password changes for
 * arbitrary user ids, the server console). This allowlist bounds the channel to what the product
 * actually uses.
 * <p>
 * Only the control channel is filtered. The file manager, desktop and terminal run over
 * {@code meshrelay.ashx} tunnels on different paths and are untouched, as is agent traffic.
 * <p>
 * Roll out in three steps: leave {@code enabled=false} while frame logging captures the actions the
 * frontend really sends, then {@code enabled=true, enforce=false} to log what would be dropped, then
 * {@code enforce=true}.
 */
@Data
@Component
@ConfigurationProperties(prefix = "openframe.tools.meshcentral.ws.control")
public class MeshControlCommandProperties {

    /** Off by default: a pod that has not been configured relays exactly as before. */
    private boolean enabled = false;

    /** false = log what would be dropped and relay it anyway; true = drop it. */
    private boolean enforce = false;

    /**
     * Request paths this applies to, matched as suffixes on the gateway-side path (the browser
     * connects to {@code /ws/tools/meshcentral-server/control.ashx}). Suffix rather than equality
     * because MeshCentral embeds the domain in some URLs it hands back to the client.
     */
    private List<String> pathSuffixes = List.of("/control.ashx");

    /**
     * Commands the frontend sends on this channel. Everything else is dropped when enforcing.
     * <p>
     * Derived from the frontend's mesh client: {@code ping}/{@code pong} keepalive,
     * {@code authcookie} (the relay/tunnel cookies the file manager and desktop then use),
     * {@code msg} (clipboard get/set), plus the power actions.
     */
    private Set<String> allowedActions = Set.of(
            "ping",
            "pong",
            "authcookie",
            "msg",
            "poweraction",
            "wake",
            "urlargs"
    );

    /** Whether this is the control channel. Deliberately says nothing about {@link #enabled}: the
     *  switch is checked by the caller and again on every frame, so that turning the feature off
     *  takes effect on sessions that are already open. */
    public boolean isControlPath(String path) {
        if (path == null || pathSuffixes == null) {
            return false;
        }
        String withoutQuery = path;
        int q = withoutQuery.indexOf('?');
        if (q >= 0) {
            withoutQuery = withoutQuery.substring(0, q);
        }
        final String p = withoutQuery;
        return pathSuffixes.stream().anyMatch(p::endsWith);
    }

    public boolean isAllowedAction(String action) {
        return action != null && allowedActions != null && allowedActions.contains(action);
    }
}
