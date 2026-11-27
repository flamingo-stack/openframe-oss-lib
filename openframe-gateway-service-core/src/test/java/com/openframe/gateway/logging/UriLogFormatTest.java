package com.openframe.gateway.logging;

import org.junit.jupiter.api.Test;

import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;

class UriLogFormatTest {

    @Test
    void withoutQuery_uriWithQueryAndFragment_keepsSchemeAuthorityAndPath() {
        // setup
        URI uri = URI.create("ws://mesh.tenant-1.svc:8383/abc/control.ashx?auth=c2VjcmV0%3D&key=v#part");

        // execution
        String text = UriLogFormat.withoutQuery(uri);

        // verifications
        assertThat(text).isEqualTo("ws://mesh.tenant-1.svc:8383/abc/control.ashx");
    }

    @Test
    void withoutQuery_uriWithoutQuery_returnedAsIs() {
        // setup
        URI uri = URI.create("http://fleet:8080/api/v1/fleet/hosts");

        // execution
        String text = UriLogFormat.withoutQuery(uri);

        // verifications
        assertThat(text).isEqualTo("http://fleet:8080/api/v1/fleet/hosts");
    }

    @Test
    void withoutQuery_relativeUri_pathOnly() {
        // setup
        URI uri = URI.create("/ws/tools/meshcentral-server/control.ashx?auth=abc");

        // execution
        String text = UriLogFormat.withoutQuery(uri);

        // verifications
        assertThat(text).isEqualTo("/ws/tools/meshcentral-server/control.ashx");
    }

    @Test
    void withoutQuery_nullUri_dash() {
        // setup
        URI uri = null;

        // execution
        String text = UriLogFormat.withoutQuery(uri);

        // verifications
        assertThat(text).isEqualTo("-");
    }
}
