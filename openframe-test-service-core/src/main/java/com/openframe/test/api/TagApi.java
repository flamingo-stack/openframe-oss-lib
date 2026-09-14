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
        return object(CREATE_TAG, "createTag", variables, TagDefinition.class);
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
        return object(UPDATE_TAG, "updateTag", variables, TagDefinition.class);
    }

    public static boolean deleteTag(String id) {
        return flag(DELETE_TAG, "deleteTag", Map.of("id", id));
    }

    public static List<TagDefinition> tagKeySuggestions(String search, int limit) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("limit", limit);
        if (search != null) {
            variables.put("search", search);
        }
        return list(TAG_KEY_SUGGESTIONS, "tagKeySuggestions", variables, TagDefinition.class);
    }

    public static List<String> tagValueSuggestions(String tagKey, String search, int limit) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("tagKey", tagKey);
        variables.put("limit", limit);
        if (search != null) {
            variables.put("search", search);
        }
        return list(TAG_VALUE_SUGGESTIONS, "tagValueSuggestions", variables, String.class);
    }

    /** {@code entityType} is DEVICE, TICKET, KNOWLEDGE_ARTICLE or SCRIPT. */
    public static List<TagDefinition> tagsByEntityType(String entityType) {
        return list(TAGS_BY_ENTITY_TYPE, "tagsByEntityType", Map.of("entityType", entityType), TagDefinition.class);
    }

    public static List<TagDefinition> scriptsTags(Boolean archived) {
        Map<String, Object> variables = new HashMap<>();
        if (archived != null) {
            variables.put("archived", archived);
        }
        return list(SCRIPTS_TAGS, "scriptsTags", variables, TagDefinition.class);
    }

    // ---- plumbing ----
    //
    // Each of these holds the response in a named local before reading a field out of it, so a
    // failure says which step produced nothing rather than pointing at one long chain.

    private static <T> T object(String document, String field, Map<String, Object> variables, Class<T> type) {
        JsonPath response = query(document, variables);
        return response.getObject("data." + field, type);
    }

    private static <T> List<T> list(String document, String field, Map<String, Object> variables, Class<T> type) {
        JsonPath response = query(document, variables);
        return response.getList("data." + field, type);
    }

    /** A mutation that answers a bare Boolean; a null answer counts as false. */
    private static boolean flag(String document, String field, Map<String, Object> variables) {
        JsonPath response = query(document, variables);
        Boolean answered = response.getObject("data." + field, Boolean.class);
        return Boolean.TRUE.equals(answered);
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
