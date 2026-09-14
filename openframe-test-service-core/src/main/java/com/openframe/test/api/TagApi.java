package com.openframe.test.api;

import com.openframe.test.data.dto.tag.TagDefinition;
import io.restassured.path.json.JsonPath;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.test.api.graphql.TagQueries.CREATE_TAG;
import static com.openframe.test.api.graphql.TagQueries.DELETE_TAG;
import static com.openframe.test.api.graphql.TagQueries.SCRIPTS_TAGS;
import static com.openframe.test.api.graphql.TagQueries.TAGS_BY_ENTITY_TYPE;
import static com.openframe.test.api.graphql.TagQueries.TAG_KEY_SUGGESTIONS;
import static com.openframe.test.api.graphql.TagQueries.TAG_VALUE_SUGGESTIONS;
import static com.openframe.test.api.graphql.TagQueries.UPDATE_TAG;
import static com.openframe.test.config.EnvironmentConfig.GRAPHQL;
import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static com.openframe.test.helpers.RequestSpecHelper.graphqlSuccess;
import static io.restassured.RestAssured.given;

/** Client for the tag API on {@code api/graphql}: definitions per entity type, suggestions, CRUD. */
public class TagApi {

    /** Idempotent per (key, entityType): re-creating returns the existing tag. */
    public static TagDefinition createTag(String key, String entityType, String description, String color) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("key", key);
        variables.put("entityType", entityType);
        variables.put("description", description);
        variables.put("color", color);
        return query(CREATE_TAG, variables).getObject("data.createTag", TagDefinition.class);
    }

    /** Partial update: an omitted field keeps its value. */
    public static TagDefinition updateTag(String id, String key, String description, String color) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("id", id);
        if (key != null) {
            variables.put("key", key);
        }
        if (description != null) {
            variables.put("description", description);
        }
        if (color != null) {
            variables.put("color", color);
        }
        return query(UPDATE_TAG, variables).getObject("data.updateTag", TagDefinition.class);
    }

    public static boolean deleteTag(String id) {
        return Boolean.TRUE.equals(query(DELETE_TAG, Map.of("id", id)).getObject("data.deleteTag", Boolean.class));
    }

    public static List<TagDefinition> tagKeySuggestions(String search, int limit) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("limit", limit);
        if (search != null) {
            variables.put("search", search);
        }
        return query(TAG_KEY_SUGGESTIONS, variables).getList("data.tagKeySuggestions", TagDefinition.class);
    }

    public static List<String> tagValueSuggestions(String tagKey, String search, int limit) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("tagKey", tagKey);
        variables.put("limit", limit);
        if (search != null) {
            variables.put("search", search);
        }
        return query(TAG_VALUE_SUGGESTIONS, variables).getList("data.tagValueSuggestions", String.class);
    }

    /** {@code entityType} is DEVICE, TICKET, KNOWLEDGE_ARTICLE or SCRIPT. */
    public static List<TagDefinition> tagsByEntityType(String entityType) {
        return query(TAGS_BY_ENTITY_TYPE, Map.of("entityType", entityType)).getList("data.tagsByEntityType", TagDefinition.class);
    }

    public static List<TagDefinition> scriptsTags(Boolean archived) {
        Map<String, Object> variables = new HashMap<>();
        if (archived != null) {
            variables.put("archived", archived);
        }
        return query(SCRIPTS_TAGS, variables).getList("data.scriptsTags", TagDefinition.class);
    }

    private static JsonPath query(String document, Map<String, Object> variables) {
        Map<String, Object> body = new HashMap<>();
        body.put("query", document);
        body.put("variables", variables);
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath();
    }
}
