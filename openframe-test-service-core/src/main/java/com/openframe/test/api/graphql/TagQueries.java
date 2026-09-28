package com.openframe.test.api.graphql;

/** GraphQL documents for tags (openframe-api-service-core {@code tag.graphqls}), served on {@code api/graphql}. */
public class TagQueries {

    private static final String TAG_FIELDS = "id key description color values entityType createdAt";

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

    public static final String UPDATE_TAG = """
            mutation UpdateTag($id: ID!, $key: String, $description: String, $color: String) {
                updateTag(id: $id, key: $key, description: $description, color: $color) { %s }
            }
            """.formatted(TAG_FIELDS);

    public static final String DELETE_TAG = """
            mutation DeleteTag($id: ID!) {
                deleteTag(id: $id)
            }
            """;

    public static final String TAG_KEY_SUGGESTIONS = """
            query TagKeySuggestions($search: String, $limit: Int) {
                tagKeySuggestions(search: $search, limit: $limit) { %s }
            }
            """.formatted(TAG_FIELDS);

    public static final String TAG_VALUE_SUGGESTIONS = """
            query TagValueSuggestions($tagKey: String!, $search: String, $limit: Int) {
                tagValueSuggestions(tagKey: $tagKey, search: $search, limit: $limit)
            }
            """;

    public static final String TAGS_BY_ENTITY_TYPE = """
            query TagsByEntityType($entityType: TagEntityType!) {
                tagsByEntityType(entityType: $entityType) { %s }
            }
            """.formatted(TAG_FIELDS);

    public static final String SCRIPTS_TAGS = """
            query ScriptsTags($archived: Boolean) {
                scriptsTags(archived: $archived) { %s }
            }
            """.formatted(TAG_FIELDS);
}
