package com.openframe.graphql.relay;

import com.netflix.graphql.dgs.DgsQueryExecutor;
import com.netflix.graphql.dgs.autoconfig.DgsAutoConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
        classes = RelayNodeIdEncodingPolicyDgsTest.RawIdsGraphQlApp.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = "dgs.graphql.schema-locations=classpath:test-schema/relay-nodes.graphqls")
class RelayNodeIdEncodingPolicyDgsTest {

    private static final String SCRIPT_ID = "script-1";
    private static final String MACHINE_DOCUMENT_ID = "machine-document-1";

    @Autowired
    private DgsQueryExecutor queryExecutor;

    @Test
    void nodeId_policyDeclinesEncoding_isThePlainIdProperty() {
        // execution
        String id = queryExecutor.executeAndExtractJsonPath("{ script { id } }", "data.script.id");

        // verifications
        assertThat(id).isEqualTo(SCRIPT_ID);
    }

    @Test
    void nodeId_ofANodeTypeWithItsOwnRawKey_policyDeclinesEncoding_isThePlainIdPropertyNotTheRawKey() {
        // execution
        String id = queryExecutor.executeAndExtractJsonPath("{ machine { id } }", "data.machine.id");

        // verifications
        assertThat(id).isEqualTo(MACHINE_DOCUMENT_ID);
    }

    @SpringBootConfiguration
    @ImportAutoConfiguration({DgsAutoConfiguration.class, RelayAutoConfiguration.class})
    @Import(RelayNodeIdWiringDgsTest.RelayNodesDataFetcher.class)
    static class RawIdsGraphQlApp {

        @Bean
        RelayIdEncodingPolicy neverEncodeRelayIds() {
            return environment -> false;
        }
    }
}
