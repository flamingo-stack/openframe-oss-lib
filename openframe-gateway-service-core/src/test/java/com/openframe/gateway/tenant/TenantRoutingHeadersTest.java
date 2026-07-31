package com.openframe.gateway.tenant;

import org.junit.jupiter.api.Test;

import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;

class TenantRoutingHeadersTest {

    @Test
    void rewritesNamespaceLabelBeforeSvc() {
        assertThat(TenantRoutingHeaders.applyToHost("meshcentral-backend.tenant-ns.svc.cluster.local", "acme"))
                .isEqualTo("meshcentral-backend.acme.svc.cluster.local");
    }

    @Test
    void leavesHostUnchangedWhenNamespaceMissing() {
        String host = "meshcentral-backend.tenant-ns.svc.cluster.local";
        assertThat(TenantRoutingHeaders.applyToHost(host, null)).isEqualTo(host);
        assertThat(TenantRoutingHeaders.applyToHost(host, "")).isEqualTo(host);
    }

    @Test
    void leavesNonClusterLocalHostUnchanged() {
        assertThat(TenantRoutingHeaders.applyToHost("hub.openframe.ai", "acme"))
                .isEqualTo("hub.openframe.ai");
        // Contains a "svc" label but is NOT *.svc.cluster.local — must not be rewritten.
        assertThat(TenantRoutingHeaders.applyToHost("foo.svc.example.com", "acme"))
                .isEqualTo("foo.svc.example.com");
    }

    @Test
    void rejectsNamespaceThatIsNotADnsLabel() {
        // Defensive: a forged value must never be spliced into the host.
        String host = "nats.tenant-ns.svc.cluster.local";
        assertThat(TenantRoutingHeaders.applyToHost(host, "evil.com/../x")).isEqualTo(host);
        assertThat(TenantRoutingHeaders.applyToHost(host, "UPPER")).isEqualTo(host);
    }

    @Test
    void rewritesUriHostPreservingSchemePortPathAndRawQuery() {
        URI in = URI.create("ws://nats.tenant-ns.svc.cluster.local:8080/ws/nats?auth=YWJjZA==&x=1");
        URI out = TenantRoutingHeaders.applyToUri(in, "acme");
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
        assertThat(TenantRoutingHeaders.applyToUri(clusterLocal, null)).isEqualTo(clusterLocal);

        URI external = URI.create("https://hub.openframe.ai/content");
        assertThat(TenantRoutingHeaders.applyToUri(external, "acme")).isEqualTo(external);
    }
}
