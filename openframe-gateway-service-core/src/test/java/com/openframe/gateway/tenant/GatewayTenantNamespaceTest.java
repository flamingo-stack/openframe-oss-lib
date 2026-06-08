package com.openframe.gateway.tenant;

import org.junit.jupiter.api.Test;

import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;

class GatewayTenantNamespaceTest {

    @Test
    void rewritesNamespaceLabelBeforeSvc() {
        assertThat(GatewayTenantNamespace.applyToHost("tactical-backend.tenant-ns.svc.cluster.local", "acme"))
                .isEqualTo("tactical-backend.acme.svc.cluster.local");
    }

    @Test
    void leavesHostUnchangedWhenNamespaceMissing() {
        String host = "tactical-backend.tenant-ns.svc.cluster.local";
        assertThat(GatewayTenantNamespace.applyToHost(host, null)).isEqualTo(host);
        assertThat(GatewayTenantNamespace.applyToHost(host, "")).isEqualTo(host);
    }

    @Test
    void leavesNonClusterLocalHostUnchanged() {
        assertThat(GatewayTenantNamespace.applyToHost("hub.openframe.ai", "acme"))
                .isEqualTo("hub.openframe.ai");
    }

    @Test
    void rejectsNamespaceThatIsNotADnsLabel() {
        // Defensive: a forged value must never be spliced into the host.
        String host = "nats.tenant-ns.svc.cluster.local";
        assertThat(GatewayTenantNamespace.applyToHost(host, "evil.com/../x")).isEqualTo(host);
        assertThat(GatewayTenantNamespace.applyToHost(host, "UPPER")).isEqualTo(host);
    }

    @Test
    void rewritesUriHostPreservingSchemePortPathAndRawQuery() {
        URI in = URI.create("ws://nats.tenant-ns.svc.cluster.local:8080/ws/nats?auth=YWJjZA==&x=1");
        URI out = GatewayTenantNamespace.applyToUri(in, "acme");
        assertThat(out.getScheme()).isEqualTo("ws");
        assertThat(out.getHost()).isEqualTo("nats.acme.svc.cluster.local");
        assertThat(out.getPort()).isEqualTo(8080);
        assertThat(out.getRawPath()).isEqualTo("/ws/nats");
        // Raw query preserved verbatim, including base64 '=' padding that strict URI builders reject.
        assertThat(out.getRawQuery()).isEqualTo("auth=YWJjZA==&x=1");
    }

    @Test
    void uriRewriteIsNoOpWhenNamespaceAbsentOrHostNotClusterLocal() {
        URI clusterLocal = URI.create("http://meshcentral.tenant-ns.svc.cluster.local:8383/path");
        assertThat(GatewayTenantNamespace.applyToUri(clusterLocal, null)).isEqualTo(clusterLocal);

        URI external = URI.create("https://hub.openframe.ai/content");
        assertThat(GatewayTenantNamespace.applyToUri(external, "acme")).isEqualTo(external);
    }
}
