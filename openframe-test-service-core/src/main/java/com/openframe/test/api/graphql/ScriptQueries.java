package com.openframe.test.api.graphql;

public class ScriptQueries {

    /**
     * The scripts-table query as issued by the web app: a Relay connection over
     * {@code scripts(...)} plus the {@code scriptFilters} facets. Only
     * {@code data.scripts.edges.node} is consumed by the test client.
     */
    public static final String SCRIPTS_TABLE_RELAY_QUERY = """
            query scriptsTableRelayQuery(
                $filter: ScriptFilterInput
                $search: String
                $first: Int!
                $after: String
            ) {
                ...scriptsTableRelay_query
                scriptFilters(filter: $filter) {
                    shells { value label count }
                    platforms { value label count }
                    authors { value label count }
                }
            }

            fragment scriptsTableRelay_query on Query {
                scripts(filter: $filter, search: $search, first: $first, after: $after) {
                    filteredCount
                    edges {
                        node {
                            id
                            name
                            description
                            shell
                            supportedPlatforms
                            defaultTimeoutSeconds
                            author {
                                id
                                firstName
                                lastName
                                email
                                image { imageUrl hash }
                            }
                        }
                        cursor
                    }
                    pageInfo { hasNextPage endCursor }
                }
            }
            """;

    public static final String GET_SCRIPT = """
            query GetScript($id: ID!) {
                script(id: $id) {
                    id
                    name
                    description
                    shell
                    privilegeLevel
                    scriptBody
                    supportedPlatforms
                    defaultTimeoutSeconds
                    defaultArgs
                    envVars { name value secret }
                    status
                    createdAt
                    updatedAt
                    author {
                        id
                        firstName
                        lastName
                        email
                        image { imageUrl hash }
                    }
                }
            }
            """;

    public static final String CREATE_SCRIPT = """
            mutation CreateScript($input: CreateScriptInput!) {
                createScript(input: $input) {
                    id
                    name
                    description
                    shell
                    privilegeLevel
                    scriptBody
                    supportedPlatforms
                    defaultTimeoutSeconds
                    defaultArgs
                    envVars { name value secret }
                    status
                }
            }
            """;

    public static final String UPDATE_SCRIPT = """
            mutation UpdateScript($input: UpdateScriptInput!) {
                updateScript(input: $input) {
                    id
                    name
                    description
                    shell
                    privilegeLevel
                    scriptBody
                    supportedPlatforms
                    defaultTimeoutSeconds
                    defaultArgs
                    envVars { name value secret }
                    status
                }
            }
            """;

    public static final String DELETE_SCRIPT = """
            mutation DeleteScript($id: ID!) {
                deleteScript(id: $id)
            }
            """;

    public static final String ARCHIVE_SCRIPT = """
            mutation ArchiveScript($id: ID!) {
                archiveScript(id: $id) {
                    id
                    status
                }
            }
            """;
}
