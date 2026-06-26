package com.openframe.test.api;

import com.openframe.test.data.dto.tag.TagDefinition;

import java.util.HashMap;
import java.util.Map;

import static com.openframe.test.api.graphql.TagQueries.CREATE_TAG;
import static com.openframe.test.config.EnvironmentConfig.GRAPHQL;
import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static com.openframe.test.helpers.RequestSpecHelper.graphqlSuccess;
import static io.restassured.RestAssured.given;

public class TagApi {

    public static TagDefinition createTag(String key, String entityType, String description, String color) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("key", key);
        variables.put("entityType", entityType);
        variables.put("description", description);
        variables.put("color", color);

        Map<String, Object> body = Map.of(
                "query", CREATE_TAG,
                "variables", variables
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.createTag", TagDefinition.class);
    }
}
