package com.openframe.test.api.graphql;

// GraphQL documents for item assignments (openframe-api-service-core assignment.graphqls) on api/graphql.
public class AssignmentQueries {

    private static final String ITEM_ASSIGNMENT_FIELDS = """
            fragment itemAssignmentFields on ItemAssignment {
                id
                itemType
                targetType
                displayName
                createdAt
                target {
                    __typename
                    id
                    ... on Ticket { ticketNumber title statusKind }
                    ... on KnowledgeBaseItem { name }
                    ... on Machine { machineId hostname }
                    ... on Organization { name }
                }
            }
            """;

    public static final String ASSIGNED_ITEM_COUNTS = """
            query($itemId: ID!) {
                assignedItemCounts(itemId: $itemId) {
                    targetType
                    count
                }
            }
            """;

    public static final String ASSIGNED_ITEMS = """
            query($itemId: ID!, $targetType: AssignmentTargetType!, $search: String, $sort: SortInput, $first: Int, $after: String) {
                assignedItems(itemId: $itemId, targetType: $targetType, search: $search, sort: $sort, first: $first, after: $after) {
                    filteredCount
                    edges {
                        node { ...itemAssignmentFields }
                        cursor
                    }
                    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
                }
            }
            """ + ITEM_ASSIGNMENT_FIELDS;

    public static final String ASSIGN_ITEM = """
            mutation($itemId: ID!, $itemType: AssignmentItemType!, $targetType: AssignmentTargetType!, $targetId: ID!) {
                assignItem(itemId: $itemId, itemType: $itemType, targetType: $targetType, targetId: $targetId) {
                    ...itemAssignmentFields
                }
            }
            """ + ITEM_ASSIGNMENT_FIELDS;

    public static final String UNASSIGN_ITEM = """
            mutation($itemId: ID!, $targetType: AssignmentTargetType!, $targetId: ID!) {
                unassignItem(itemId: $itemId, targetType: $targetType, targetId: $targetId)
            }
            """;

    public static final String UNASSIGN_ALL_BY_TYPE = """
            mutation($itemId: ID!, $targetType: AssignmentTargetType!) {
                unassignAllByType(itemId: $itemId, targetType: $targetType)
            }
            """;
}
