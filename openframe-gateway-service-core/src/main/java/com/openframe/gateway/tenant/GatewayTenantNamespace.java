package com.openframe.gateway.tenant;

import org.springframework.http.server.reactive.ServerHttpRequest;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Per-request tenant-namespace rewriting for a shared multi-tenant gateway pod.
 * <p>
 * In the per-tenant deployment a gateway pod served one tenant, so upstream hosts could bake the
 * tenant's Kubernetes namespace in at startup (the {@code ${TENANT_NS}} property). A shared pod
 * serves many tenants, so the namespace must be resolved per request instead — from the trusted
 * {@code X-Tenant-Ns} / {@code X-Tenant-Id} headers the shared (apex) gateway injects and the
 * tenant gateway validates ({@code TenantContextWebFilter}).
 * <p>
 * This helper substitutes that per-request namespace into an upstream host's namespace label
 * (e.g. {@code tactical-backend.<placeholder>.svc.cluster.local} →
 * {@code tactical-backend.<tenantNs>.svc.cluster.local}). It is intentionally <em>additive</em>:
 * when no {@code X-Tenant-Ns} header is present (single-tenant / OSS pods) the configured host is
 * returned verbatim, so those deployments are unaffected.
 * <p>
 * The header names match (by value) those defined locally in the SaaS tenant gateway; they are kept
 * in sync by convention rather than shared through a type, mirroring that repository's choice.
 */
public final class GatewayTenantNamespace {

    /** Trusted per-request tenant headers, injected by the shared gateway behind the trust boundary. */
    public static final String TENANT_ID_HEADER = "X-Tenant-Id";
    public static final String TENANT_NS_HEADER = "X-Tenant-Ns";

    /** Literal token used in shared-pod config where a per-request tenant id is spliced into a path. */
    public static final String TENANT_UUID_PLACEHOLDER = "tenant-uuid";

    private static final String SVC_LABEL = "svc";

    /**
     * DNS-1123 label. Guards the namespace before it is spliced into a hostname so a stray/forged
     * header cannot inject arbitrary host content in a context that did not validate it upstream.
     */
    private static final Pattern DNS_LABEL = Pattern.compile("[a-z0-9]([-a-z0-9]{0,61}[a-z0-9])?");

    private GatewayTenantNamespace() {
    }

    /** The per-request tenant namespace ({@code X-Tenant-Ns}), or {@code null} if absent. */
    public static String tenantNamespace(ServerHttpRequest request) {
        return request.getHeaders().getFirst(TENANT_NS_HEADER);
    }

    /** The per-request tenant id ({@code X-Tenant-Id}), or {@code null} if absent. */
    public static String tenantId(ServerHttpRequest request) {
        return request.getHeaders().getFirst(TENANT_ID_HEADER);
    }

    /**
     * Replace the namespace label (the label immediately before {@code svc}) of a Kubernetes
     * cluster-local host with {@code ns}. Returns the host unchanged when {@code ns} is blank, is not
     * a valid DNS-1123 label, or the host is not a {@code *.svc.cluster.local} address.
     */
    public static String applyToHost(String host, String ns) {
        if (host == null || ns == null || ns.isEmpty() || !DNS_LABEL.matcher(ns).matches()) {
            return host;
        }
        String[] labels = host.split("\\.");
        for (int i = 1; i < labels.length; i++) {
            if (SVC_LABEL.equals(labels[i])) {
                labels[i - 1] = ns;
                return String.join(".", labels);
            }
        }
        return host;
    }

    /**
     * Rewrite the namespace of a URI's host, preserving scheme, userinfo, port, raw path, raw query
     * and fragment verbatim. Raw components are kept deliberately: tool auth cookies carry base64
     * {@code '='} in the query that strict URI builders reject.
     */
    public static URI applyToUri(URI uri, String ns) {
        if (uri == null || uri.getHost() == null) {
            return uri;
        }
        String newHost = applyToHost(uri.getHost(), ns);
        if (newHost.equals(uri.getHost())) {
            return uri;
        }
        String newAuthority = uri.getRawAuthority()
                .replaceFirst(Pattern.quote(uri.getHost()), Matcher.quoteReplacement(newHost));
        StringBuilder sb = new StringBuilder();
        sb.append(uri.getScheme()).append("://").append(newAuthority);
        if (uri.getRawPath() != null) {
            sb.append(uri.getRawPath());
        }
        if (uri.getRawQuery() != null) {
            sb.append("?").append(uri.getRawQuery());
        }
        if (uri.getRawFragment() != null) {
            sb.append("#").append(uri.getRawFragment());
        }
        try {
            return new URI(sb.toString());
        } catch (URISyntaxException e) {
            throw new IllegalStateException("Failed to rewrite tenant namespace in URI: " + uri, e);
        }
    }
}
