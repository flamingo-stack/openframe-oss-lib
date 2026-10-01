package com.openframe.test.api.graphql;

// Frontend feature flag documents on api/graphql; the UI shell runs FE_FEATURE_FLAGS on every session with its own flag names.
public class FeatureFlagQueries {

    public static final String FE_FEATURE_FLAGS = """
            query FeFeatureFlags($names: [String!]) {
                feFeatureFlags(names: $names) {
                    name
                    enabled
                }
            }
            """;
}
