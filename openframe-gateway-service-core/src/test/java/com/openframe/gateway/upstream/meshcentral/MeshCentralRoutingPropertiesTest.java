package com.openframe.gateway.upstream.meshcentral;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MeshCentralRoutingPropertiesTest {

    @Test
    void toString_credentialsSet_passwordLeftOut() {
        // setup
        MeshCentralRoutingProperties properties = new MeshCentralRoutingProperties();
        properties.getCredentials().setUsername("operator@example.com");
        properties.getCredentials().setPassword("s3cr3t-value");

        // execution
        String text = properties.toString();

        // verifications
        assertThat(text)
                .contains("operator@example.com")
                .doesNotContain("s3cr3t-value");
    }
}
