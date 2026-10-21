package com.openframe.gateway.config.ws;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
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
     * The MeshCentral websocket space this applies to. Everything under these prefixes is treated as
     * the command channel unless it is one of {@link #tunnelSuffixes}.
     * <p>
     * Deliberately inverted. Matching only {@code /control.ashx} as a suffix leaves the filter open to
     * every spelling Express accepts but a literal comparison does not: Express routes on the decoded
     * path and, by default, is neither case sensitive ({@code caseSensitive=false}) nor strict about a
     * trailing slash ({@code strict=false}), so {@code /Control.ashx}, {@code /control.ashx/} and
     * {@code /control%2Eashx} all reach the same handler. Normalising covers those, but the next
     * spelling would not be covered, whereas an unlisted tunnel shows up as a warning during the
     * {@code enforce=false} phase, before anything is dropped.
     */
    private List<String> pathPrefixes = List.of("/ws/tools/meshcentral-server/");

    /**
     * Endpoints under {@link #pathPrefixes} that are byte tunnels, not command channels: the desktop,
     * terminal, file manager, IDER/AMT and agent transfers. Their frames are relayed untouched.
     * Matched on the normalised path, so the entry is the bare endpoint name.
     *
     * @see <a href="https://github.com/Ylianst/MeshCentral/blob/master/webserver.js">webserver.js, obj.app.ws(...) routes</a>
     */
    private List<String> tunnelSuffixes = List.of(
            "meshrelay.ashx",
            "localrelay.ashx",
            "webrelay.ashx",
            "webider.ashx",
            "devicefile.ashx",
            "agenttransfer.ashx",
            "agent.ashx",
            "recordings.ashx",
            "mstscrelay.ashx",
            "sshrelay.ashx",
            "sshterminalrelay.ashx",
            "sshfilesrelay.ashx",
            "firebaserelay.aspx",
            "echo.ashx",
            "2fahold.ashx",
            "apf.ashx",
            "meshserver.ashx",
            "ipkvm.ashx"
    );

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
        if (path == null || pathPrefixes == null) {
            return false;
        }
        final String p = normalize(path);
        if (pathPrefixes.stream().noneMatch(prefix -> p.startsWith(normalize(prefix)))) {
            return false;
        }
        return tunnelSuffixes == null || tunnelSuffixes.stream().map(MeshControlCommandProperties::normalize)
                .noneMatch(t -> p.endsWith("/" + t) || p.contains("/" + t + "/"));
    }

    /** The path as Express sees it when it routes: query dropped, percent-decoded, lower case, no
     *  trailing slash. A tunnel is matched both at the end of the path and as a segment of it, since
     *  ipkvm.ashx routes with a wildcard and carries further segments. */
    private static String normalize(String path) {
        String p = path;
        int q = p.indexOf('?');
        if (q >= 0) {
            p = p.substring(0, q);
        }
        try {
            p = URLDecoder.decode(p, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            // Malformed escape: keep the raw form rather than letting it through unmatched.
        }
        p = p.toLowerCase(Locale.ROOT);
        while (p.length() > 1 && p.endsWith("/")) {
            p = p.substring(0, p.length() - 1);
        }
        return p;
    }

    public boolean isAllowedAction(String action) {
        return action != null && allowedActions != null && allowedActions.contains(action);
    }
}
