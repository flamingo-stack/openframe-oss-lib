package com.openframe.graphql.relay;

import graphql.schema.DataFetchingEnvironment;

public class AlwaysEncodeRelayIds implements RelayIdEncodingPolicy {

    @Override
    public boolean shouldEncode(DataFetchingEnvironment environment) {
        return true;
    }
}
