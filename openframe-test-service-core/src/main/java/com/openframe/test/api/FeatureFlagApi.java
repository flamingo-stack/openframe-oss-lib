package com.openframe.test.api;

import com.openframe.test.data.dto.featureflag.FeFeatureFlag;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.test.api.graphql.FeatureFlagQueries.FE_FEATURE_FLAGS;
import static com.openframe.test.config.EnvironmentConfig.GRAPHQL;
import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static com.openframe.test.helpers.RequestSpecHelper.graphqlSuccess;
import static io.restassured.RestAssured.given;

// Frontend feature flags client; read-only, the flags are only ever changed by config or a stored tenant override.
public class FeatureFlagApi {

    // A null names leaves the variable out, which answers every flag the tenant knows.
    public static List<FeFeatureFlag> getFeFeatureFlags(List<String> names) {
        Map<String, Object> variables = new HashMap<>();
        if (names != null) {
            variables.put("names", names);
        }
        return given(getAuthorizedSpec())
                .body(Map.of("query", FE_FEATURE_FLAGS, "variables", variables)).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getList("data.feFeatureFlags", FeFeatureFlag.class);
    }
}
