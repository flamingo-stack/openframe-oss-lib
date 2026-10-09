package com.openframe.graphql.relay;

import graphql.schema.DataFetchingEnvironment;

public interface RelayIdEncodingPolicy {

    boolean shouldEncode(DataFetchingEnvironment environment);
}
