package com.openframe.test.api.graphql;

public class TagQueries {

    public static final String CREATE_TAG = """
            mutation CreateTag($key: String!, $entityType: String!, $description: String, $color: String) {
                createTag(key: $key, entityType: $entityType, description: $description, color: $color) {
                    id
                    key
                    description
                    color
                    entityType
                    createdAt
                }
            }
            """;
}
