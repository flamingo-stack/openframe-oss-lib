package com.openframe.test.api;

import com.openframe.test.data.dto.assignment.AssignedItemCount;
import com.openframe.test.data.dto.assignment.AssignmentItemType;
import com.openframe.test.data.dto.assignment.AssignmentTargetType;
import com.openframe.test.data.dto.assignment.ItemAssignment;
import com.openframe.test.data.dto.assignment.ItemAssignmentConnection;
import com.openframe.test.data.dto.shared.SortInput;
import io.restassured.path.json.JsonPath;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.test.api.graphql.AssignmentQueries.ASSIGNED_ITEMS;
import static com.openframe.test.api.graphql.AssignmentQueries.ASSIGNED_ITEM_COUNTS;
import static com.openframe.test.api.graphql.AssignmentQueries.ASSIGN_ITEM;
import static com.openframe.test.api.graphql.AssignmentQueries.UNASSIGN_ALL_BY_TYPE;
import static com.openframe.test.api.graphql.AssignmentQueries.UNASSIGN_ITEM;
import static com.openframe.test.config.EnvironmentConfig.GRAPHQL;
import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static com.openframe.test.helpers.RequestSpecHelper.graphqlSuccess;
import static io.restassured.RestAssured.given;

// Client for item assignments on api/graphql; every id argument is a Relay global id.
public class AssignmentApi {

    public static List<AssignedItemCount> assignedItemCounts(String itemId) {
        JsonPath response = query(ASSIGNED_ITEM_COUNTS, Map.of("itemId", itemId));
        return response.getList("data.assignedItemCounts", AssignedItemCount.class);
    }

    public static ItemAssignmentConnection assignedItems(String itemId, AssignmentTargetType targetType) {
        return assignedItems(itemId, targetType, null, null, null, null);
    }

    // search, sort, first and after are optional and left out of the variables when null.
    public static ItemAssignmentConnection assignedItems(String itemId, AssignmentTargetType targetType, String search,
                                                         SortInput sort, Integer first, String after) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("itemId", itemId);
        variables.put("targetType", targetType);
        putIfPresent(variables, "search", search);
        putIfPresent(variables, "sort", sort);
        putIfPresent(variables, "first", first);
        putIfPresent(variables, "after", after);
        JsonPath response = query(ASSIGNED_ITEMS, variables);
        return response.getObject("data.assignedItems", ItemAssignmentConnection.class);
    }

    public static ItemAssignment assignItem(String itemId, AssignmentItemType itemType,
                                            AssignmentTargetType targetType, String targetId) {
        Map<String, Object> variables = Map.of(
                "itemId", itemId, "itemType", itemType, "targetType", targetType, "targetId", targetId);
        JsonPath response = query(ASSIGN_ITEM, variables);
        return response.getObject("data.assignItem", ItemAssignment.class);
    }

    public static Boolean unassignItem(String itemId, AssignmentTargetType targetType, String targetId) {
        JsonPath response = query(UNASSIGN_ITEM, unassignVariables(itemId, targetType, targetId));
        return response.getObject("data.unassignItem", Boolean.class);
    }

    // An unassign for teardown, where the assignment may already be gone: returns the HTTP status instead of asserting.
    public static int unassignItemRaw(String itemId, AssignmentTargetType targetType, String targetId) {
        Map<String, Object> body = Map.of("query", UNASSIGN_ITEM, "variables", unassignVariables(itemId, targetType, targetId));
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().extract().statusCode();
    }

    // Removes every assignment of one item to one target type; it never touches another item's assignments.
    public static Boolean unassignAllByType(String itemId, AssignmentTargetType targetType) {
        JsonPath response = query(UNASSIGN_ALL_BY_TYPE, Map.of("itemId", itemId, "targetType", targetType));
        return response.getObject("data.unassignAllByType", Boolean.class);
    }

    private static Map<String, Object> unassignVariables(String itemId, AssignmentTargetType targetType, String targetId) {
        return Map.of("itemId", itemId, "targetType", targetType, "targetId", targetId);
    }

    private static void putIfPresent(Map<String, Object> variables, String name, Object value) {
        if (value != null) {
            variables.put(name, value);
        }
    }

    private static JsonPath query(String document, Map<String, Object> variables) {
        Map<String, Object> body = Map.of("query", document, "variables", variables);
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath();
    }
}
