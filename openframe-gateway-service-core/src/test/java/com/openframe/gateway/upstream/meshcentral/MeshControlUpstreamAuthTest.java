package com.openframe.gateway.upstream.meshcentral;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class MeshControlUpstreamAuthTest {

    private static final String CONTROL_PATH = "/ws/tools/meshcentral-server/control.ashx";
    private static final String USERNAME = "operator@example.com";
    private static final String PASSWORD = "p@ss,wörd=1";

    private MeshCentralRoutingProperties properties;

    @BeforeEach
    void setUp() {
        properties = new MeshCentralRoutingProperties();
        properties.getCredentials().setUsername(USERNAME);
        properties.getCredentials().setPassword(PASSWORD);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/ws/tools/meshcentral-server/control.ashx",
            "/ws/tools/meshcentral-server/Control.ASHX",
            "/ws/tools/meshcentral-server/control.ashx/"
    })
    void appliesTo_controlEndpointSpelling_true(String path) {
        // setup
        MeshControlUpstreamAuth auth = new MeshControlUpstreamAuth(properties);

        // execution
        boolean applies = auth.appliesTo(path);

        // verifications
        assertThat(applies).isTrue();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {
            "/ws/tools/meshcentral-server/meshrelay.ashx",
            "/ws/tools/meshcentral-server/agent.ashx",
            "/ws/tools/meshcentral-server/control.ashx/extra",
            "/ws/tools/meshcentral-server/mycontrol.ashx",
            "/ws/tools/meshcentral-server/tenant-1/control.ashx",
            "/ws/tools/meshcentral-server/ipkvm.ashx/control.ashx",
            "/ws/tools/meshcentral-server/control%2Eashx",
            "/ws/tools/meshcentral-server/",
            "/ws/tools/fleetmdm-server/control.ashx",
            "/ws/tools/agent/meshcentral-server/control.ashx",
            "/ws/toolsx/meshcentral-server/ws/tools/meshcentral-server/control.ashx",
            "/WS/TOOLS/meshcentral-server/control.ashx",
            "/control.ashx"
    })
    void appliesTo_otherEndpoint_false(String path) {
        // setup
        MeshControlUpstreamAuth auth = new MeshControlUpstreamAuth(properties);

        // execution
        boolean applies = auth.appliesTo(path);

        // verifications
        assertThat(applies).isFalse();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void appliesTo_credentialsNotConfigured_false(String blank) {
        // setup
        properties.getCredentials().setUsername(blank);
        properties.getCredentials().setPassword(blank);
        MeshControlUpstreamAuth auth = new MeshControlUpstreamAuth(properties);

        // execution
        boolean applies = auth.appliesTo(CONTROL_PATH);

        // verifications
        assertThat(applies).isFalse();
    }

    @Test
    void isEnabled_credentialsConfigured_true() {
        // setup
        MeshControlUpstreamAuth auth = new MeshControlUpstreamAuth(properties);

        // execution
        boolean enabled = auth.isEnabled();

        // verifications
        assertThat(enabled).isTrue();
    }

    @Test
    void isEnabled_credentialsNotConfigured_false() {
        // setup
        properties.setCredentials(new MeshCentralRoutingProperties.Credentials());
        MeshControlUpstreamAuth auth = new MeshControlUpstreamAuth(properties);

        // execution
        boolean enabled = auth.isEnabled();

        // verifications
        assertThat(enabled).isFalse();
    }

    @Test
    void appliesTo_credentialsBlockMissing_false() {
        // setup
        properties.setCredentials(null);
        MeshControlUpstreamAuth auth = new MeshControlUpstreamAuth(properties);

        // execution
        boolean applies = auth.appliesTo(CONTROL_PATH);

        // verifications
        assertThat(applies).isFalse();
    }

    @ParameterizedTest
    @CsvSource({
            "operator@example.com,",
            "operator@example.com,' '",
            ",secret",
            "'',secret"
    })
    void constructor_onlyOneCredentialSet_throwsIllegalState(String username, String password) {
        // setup
        properties.getCredentials().setUsername(username);
        properties.getCredentials().setPassword(password);

        // execution
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> new MeshControlUpstreamAuth(properties));

        // verifications
        assertThat(ex.getMessage())
                .contains("needs both username and password")
                .doesNotContain("secret");
    }

    @Test
    void headerValue_configured_twoBase64PartsDecodingToTheCredentials() {
        // setup
        MeshControlUpstreamAuth auth = new MeshControlUpstreamAuth(properties);
        String expectedUser = Base64.getEncoder().encodeToString(USERNAME.getBytes(StandardCharsets.UTF_8));
        String expectedPass = Base64.getEncoder().encodeToString(PASSWORD.getBytes(StandardCharsets.UTF_8));

        // execution
        String header = auth.headerValue();

        // verifications
        assertThat(header).isEqualTo(expectedUser + "," + expectedPass);
        assertThat(header.split(",")).hasSize(2);
    }

    @Test
    void headerValue_notConfigured_throwsIllegalState() {
        // setup
        properties.setCredentials(new MeshCentralRoutingProperties.Credentials());
        MeshControlUpstreamAuth auth = new MeshControlUpstreamAuth(properties);

        // execution
        IllegalStateException ex = assertThrows(IllegalStateException.class, auth::headerValue);

        // verifications
        assertThat(ex.getMessage()).contains("not configured");
    }

    @ParameterizedTest
    @CsvSource({
            "user=a&pass=b&auth=c%3D%3D&authorization=x.y.z, auth=c%3D%3D&authorization=x.y.z",
            "auth=c==&user=a&key=1&pass=b, auth=c==&key=1",
            "%75ser=a&p%61ss=b&key=1, key=1",
            "user&pass&key=1, key=1",
            "user=a&user=b&pass=c&key=1, key=1",
            "user[]=a&pass[0]=b&key=1, key=1",
            "user%5B%5D=a&pass%5Bx%5D=b&key=1, key=1"
    })
    void withoutCredentialParams_credentialPairsPresent_onlyThosePairsRemoved(String query, String expectedQuery) {
        // setup
        MeshControlUpstreamAuth auth = new MeshControlUpstreamAuth(properties);
        URI upstream = URI.create("ws://mesh.tenant-1.svc:8383/tenant-1/control.ashx?" + query);

        // execution
        URI result = auth.withoutCredentialParams(upstream);

        // verifications
        assertThat(result).hasToString("ws://mesh.tenant-1.svc:8383/tenant-1/control.ashx?" + expectedQuery);
    }

    @Test
    void withoutCredentialParams_onlyCredentialPairs_queryDropped() {
        // setup
        MeshControlUpstreamAuth auth = new MeshControlUpstreamAuth(properties);
        URI upstream = URI.create("ws://mesh.tenant-1.svc:8383/tenant-1/control.ashx?user=a&pass=b");

        // execution
        URI result = auth.withoutCredentialParams(upstream);

        // verifications
        assertThat(result).hasToString("ws://mesh.tenant-1.svc:8383/tenant-1/control.ashx");
    }

    @Test
    void withoutCredentialParams_uriWithFragment_fragmentKept() {
        // setup
        MeshControlUpstreamAuth auth = new MeshControlUpstreamAuth(properties);
        URI upstream = URI.create("ws://mesh.tenant-1.svc:8383/tenant-1/control.ashx?user=a&key=1#part");

        // execution
        URI result = auth.withoutCredentialParams(upstream);

        // verifications
        assertThat(result).hasToString("ws://mesh.tenant-1.svc:8383/tenant-1/control.ashx?key=1#part");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "ws://mesh.tenant-1.svc:8383/tenant-1/control.ashx",
            "ws://mesh.tenant-1.svc:8383/tenant-1/control.ashx?auth=c==&username=a&password=b&User=c"
    })
    void withoutCredentialParams_noCredentialPairs_sameUriReturned(String uri) {
        // setup
        MeshControlUpstreamAuth auth = new MeshControlUpstreamAuth(properties);
        URI upstream = URI.create(uri);

        // execution
        URI result = auth.withoutCredentialParams(upstream);

        // verifications
        assertThat(result).isSameAs(upstream);
    }
}
