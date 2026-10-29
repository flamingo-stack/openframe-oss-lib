package com.openframe.test.api.graphql;

public class ToolQueries {

    public static final String INTEGRATED_TOOLS = """
            query($filter: ToolFilterInput, $search: String) {
                integratedTools(filter: $filter, search: $search) {
                    tools {
                        id
                        name
                        description
                        type
                        category
                        platformCategory
                        enabled
                    }
                }
            }
            """;

    public static final String TOOL_FILTERS = """
            query {
                toolFilters {
                    types
                    categories
                    platformCategories
                }
            }
            """;
}
