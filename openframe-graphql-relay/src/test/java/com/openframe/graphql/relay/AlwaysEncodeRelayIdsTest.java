package com.openframe.graphql.relay;

import graphql.schema.DataFetchingEnvironment;
import graphql.schema.DataFetchingEnvironmentImpl;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AlwaysEncodeRelayIdsTest {

    private final AlwaysEncodeRelayIds policy = new AlwaysEncodeRelayIds();

    @Test
    void shouldEncode_anyRequest_isTrue() {
        // setup
        DataFetchingEnvironment environment = DataFetchingEnvironmentImpl.newDataFetchingEnvironment().build();

        // execution
        boolean encode = policy.shouldEncode(environment);

        // verifications
        assertThat(encode).isTrue();
    }
}
