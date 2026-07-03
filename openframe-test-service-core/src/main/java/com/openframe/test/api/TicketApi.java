package com.openframe.test.api;

import com.openframe.test.data.dto.shared.CursorPaginationInput;
import com.openframe.test.data.dto.shared.GraphqlError;
import com.openframe.test.data.dto.ticket.CreateTicketInput;
import com.openframe.test.data.dto.ticket.CreateTicketStatusInput;
import com.openframe.test.data.dto.ticket.DeleteTicketStatusInput;
import com.openframe.test.data.dto.ticket.ReorderTicketInput;
import com.openframe.test.data.dto.ticket.Ticket;
import com.openframe.test.data.dto.ticket.TicketConnection;
import com.openframe.test.data.dto.ticket.TicketFilterInput;
import com.openframe.test.data.dto.ticket.TicketLabel;
import com.openframe.test.data.dto.ticket.TicketStatusDefinition;
import com.openframe.test.data.dto.ticket.TicketUserError;
import com.openframe.test.data.dto.ticket.TransitionTicketInput;
import com.openframe.test.data.generator.TicketGenerator;
import io.restassured.path.json.JsonPath;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.test.api.graphql.TicketQueries.CREATE_TICKET;
import static com.openframe.test.api.graphql.TicketQueries.CREATE_TICKET_STATUS;
import static com.openframe.test.api.graphql.TicketQueries.DELETE_TICKET_STATUS;
import static com.openframe.test.api.graphql.TicketQueries.GET_TICKET;
import static com.openframe.test.api.graphql.TicketQueries.GET_TICKETS;
import static com.openframe.test.api.graphql.TicketQueries.REORDER_TICKET;
import static com.openframe.test.api.graphql.TicketQueries.TICKET_LABELS;
import static com.openframe.test.api.graphql.TicketQueries.TICKET_STATUSES;
import static com.openframe.test.api.graphql.TicketQueries.TRANSITION_TICKET;
import static com.openframe.test.config.EnvironmentConfig.CHAT_GRAPHQL;
import static com.openframe.test.data.generator.CursorGenerator.limit;
import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static com.openframe.test.helpers.RequestSpecHelper.graphqlSuccess;
import static io.restassured.RestAssured.given;

public class TicketApi {

    public static TicketConnection getTickets(TicketFilterInput filter, CursorPaginationInput pagination) {
        return getTickets(filter, pagination, null);
    }

    public static TicketConnection getTickets(TicketFilterInput filter, CursorPaginationInput pagination, String search) {
        Map<String, Object> variables = new HashMap<>();
        if (filter != null) variables.put("filter", filter);
        if (pagination != null) variables.put("pagination", pagination);
        if (search != null) variables.put("search", search);
        Map<String, Object> body = Map.of(
                "query", GET_TICKETS,
                "variables", variables
        );
        return given(getAuthorizedSpec())
                .body(body).post(CHAT_GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.tickets", TicketConnection.class);
    }

    public static Ticket getTicket(String id) {
        Map<String, Object> body = Map.of(
                "query", GET_TICKET,
                "variables", Map.of("id", id)
        );
        return given(getAuthorizedSpec())
                .body(body).post(CHAT_GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.ticket", Ticket.class);
    }

    public static TicketConnection findColumnWithAtLeastTwoTickets() {
        for (TicketStatusDefinition status : getTicketStatuses()) {
            TicketConnection column = getTickets(TicketGenerator.ticketsWithStatusId(status.getId()), limit(20));
            if (column.getEdges() != null && column.getEdges().size() >= 2) {
                return column;
            }
        }
        return null;
    }

    public static Ticket reorderTicket(ReorderTicketInput input) {
        return mutateTicket(REORDER_TICKET, "reorderTicket", Map.of("input", input));
    }

    public static List<TicketStatusDefinition> getTicketStatuses() {
        Map<String, Object> body = Map.of("query", TICKET_STATUSES);
        return given(getAuthorizedSpec())
                .body(body).post(CHAT_GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getList("data.ticketStatuses", TicketStatusDefinition.class);
    }

    public static TicketStatusDefinition createTicketStatus(CreateTicketStatusInput input) {
        Map<String, Object> body = Map.of(
                "query", CREATE_TICKET_STATUS,
                "variables", Map.of("input", input)
        );
        return given(getAuthorizedSpec())
                .body(body).post(CHAT_GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.createTicketStatus", TicketStatusDefinition.class);
    }

    public static boolean deleteTicketStatus(String id) {
        return deleteTicketStatus(id, null);
    }

    public static boolean deleteTicketStatus(String id, String replacementStatusId) {
        Map<String, Object> body = Map.of(
                "query", DELETE_TICKET_STATUS,
                "variables", Map.of("input", DeleteTicketStatusInput.builder()
                        .id(id).replacementStatusId(replacementStatusId).build())
        );
        return given(getAuthorizedSpec())
                .body(body).post(CHAT_GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getBoolean("data.deleteTicketStatus");
    }

    /**
     * Attempts to delete a status expected to be rejected (e.g. a system status). Like invalid
     * transitions, status-mutation domain errors surface as top-level GraphQL errors, not
     * {@code userErrors}, so this does not use the {@code graphqlSuccess()} spec.
     */
    public static List<GraphqlError> attemptDeleteTicketStatusErrors(String id) {
        Map<String, Object> body = Map.of(
                "query", DELETE_TICKET_STATUS,
                "variables", Map.of("input", DeleteTicketStatusInput.builder().id(id).build())
        );
        return given(getAuthorizedSpec())
                .body(body).post(CHAT_GRAPHQL)
                .then().statusCode(200)
                .extract().jsonPath().getList("errors", GraphqlError.class);
    }

    /**
     * Resolves the id of the system status definition for the given lifecycle kind
     * (e.g. RESOLVED, ARCHIVED, TECH_REQUIRED, AI_ASSISTANCE). Used to build
     * {@code transitionTicket} calls, which target a status definition id rather
     * than the legacy status enum.
     */
    public static String resolveSystemStatusId(String kind) {
        return getTicketStatuses().stream()
                .filter(TicketStatusDefinition::isSystem)
                .filter(status -> kind.equals(status.getKind()))
                .map(TicketStatusDefinition::getId)
                .findFirst()
                .orElse(null);
    }

    public static Ticket transitionTicket(String ticketId, String toStatusId) {
        return mutateTicket(TRANSITION_TICKET, "transitionTicket",
                Map.of("input", TransitionTicketInput.builder().ticketId(ticketId).toStatusId(toStatusId).build()));
    }

    /**
     * Attempts a transition expected to be rejected. An invalid lifecycle transition is raised as a
     * top-level GraphQL error (not a domain {@code userErrors} entry), so this does not use the
     * {@code graphqlSuccess()} spec (which asserts {@code errors} is null).
     */
    public static List<GraphqlError> attemptTransitionTicketErrors(String ticketId, String toStatusId) {
        Map<String, Object> body = Map.of(
                "query", TRANSITION_TICKET,
                "variables", Map.of("input", TransitionTicketInput.builder().ticketId(ticketId).toStatusId(toStatusId).build())
        );
        return given(getAuthorizedSpec())
                .body(body).post(CHAT_GRAPHQL)
                .then().statusCode(200)
                .extract().jsonPath().getList("errors", GraphqlError.class);
    }

    public static Ticket createTicket(CreateTicketInput input) {
        return mutateTicket(CREATE_TICKET, "createTicket", Map.of("input", input));
    }

    public static List<TicketLabel> getTicketLabels() {
        Map<String, Object> body = Map.of("query", TICKET_LABELS);
        return given(getAuthorizedSpec())
                .body(body).post(CHAT_GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getList("data.ticketLabels", TicketLabel.class);
    }

    private static Ticket mutateTicket(String query, String mutationName, Map<String, Object> variables) {
        JsonPath response = given(getAuthorizedSpec())
                .body(Map.of("query", query, "variables", variables))
                .post(CHAT_GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath();
        List<TicketUserError> userErrors = response.getList("data." + mutationName + ".userErrors", TicketUserError.class);
        if (userErrors != null && !userErrors.isEmpty()) {
            throw new AssertionError(mutationName + " returned userErrors: " + userErrors);
        }
        return response.getObject("data." + mutationName + ".ticket", Ticket.class);
    }
}
