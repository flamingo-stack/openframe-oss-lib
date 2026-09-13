package com.openframe.test.api;

import com.openframe.test.data.dto.shared.CursorPaginationInput;
import com.openframe.test.data.dto.shared.GraphqlError;
import com.openframe.test.data.dto.ticket.TakeOverTicketInput;
import com.openframe.test.data.dto.ticket.TicketReopenInput;
import com.openframe.test.data.dto.ticket.TicketReopenPayload;
import com.openframe.test.data.dto.ticket.CreateTicketInput;
import com.openframe.test.data.dto.ticket.CreateTicketStatusInput;
import com.openframe.test.data.dto.ticket.DeleteTicketStatusInput;
import com.openframe.test.data.dto.ticket.ReorderTicketInput;
import com.openframe.test.data.dto.ticket.Ticket;
import com.openframe.test.data.dto.ticket.TicketConnection;
import com.openframe.test.data.dto.ticket.TicketFilterInput;
import com.openframe.test.data.dto.ticket.TicketTag;
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
import static com.openframe.test.api.graphql.TicketQueries.TICKET_TAGS;
import static com.openframe.test.api.graphql.TicketQueries.TICKET_STATUSES;
import static com.openframe.test.api.graphql.TicketQueries.REQUEST_TICKET_REOPEN;
import static com.openframe.test.api.graphql.TicketQueries.TAKE_OVER_TICKET;
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
            TicketConnection column = getTickets(TicketGenerator.activeTicketsWithStatusId(status.getId()), limit(20));
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

    /** Transition and assignment in one operation; fails on userErrors like every other ticket mutation here. */
    public static Ticket takeOverTicket(String ticketId, String toStatusId, String assigneeId) {
        return mutateTicket(TAKE_OVER_TICKET, "takeOverTicket", Map.of("input",
                TakeOverTicketInput.builder().ticketId(ticketId).toStatusId(toStatusId).assigneeId(assigneeId).build()));
    }

    /**
     * A take-over expected to be refused. The lifecycle may report the refusal either as a top-level
     * GraphQL error (an invalid transition, code TICKET_INVALID_TRANSITION) or as a {@code userErrors}
     * entry, so both are collected as messages; empty means the server accepted it.
     */
    public static List<String> attemptTakeOverTicketMessages(String ticketId, String toStatusId, String assigneeId) {
        Map<String, Object> body = Map.of("query", TAKE_OVER_TICKET, "variables", Map.of("input",
                TakeOverTicketInput.builder().ticketId(ticketId).toStatusId(toStatusId).assigneeId(assigneeId).build()));
        JsonPath response = given(getAuthorizedSpec())
                .body(body).post(CHAT_GRAPHQL)
                .then().statusCode(200)
                .extract().jsonPath();
        List<String> messages = new java.util.ArrayList<>();
        List<GraphqlError> errors = response.getList("errors", GraphqlError.class);
        if (errors != null) {
            errors.forEach(e -> messages.add(String.valueOf(e.getMessage())));
        }
        List<TicketUserError> userErrors = response.getList("data.takeOverTicket.userErrors", TicketUserError.class);
        if (userErrors != null) {
            userErrors.forEach(e -> messages.add(String.valueOf(e.getMessage())));
        }
        return messages;
    }

    /**
     * Client-initiated reopen; returns the payload as-is so a case can assert {@code userErrors}
     * itself. Only an AGENT session may call it.
     */
    public static TicketReopenPayload requestTicketReopen(TicketReopenInput input) {
        return given(getAuthorizedSpec())
                .body(Map.of("query", REQUEST_TICKET_REOPEN, "variables", Map.of("input", input)))
                .post(CHAT_GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.requestTicketReopen", TicketReopenPayload.class);
    }

    /** A reopen expected to be refused (an ADMIN caller); returns the top-level GraphQL errors. */
    public static List<GraphqlError> attemptRequestTicketReopenErrors(TicketReopenInput input) {
        List<GraphqlError> errors = given(getAuthorizedSpec())
                .body(Map.of("query", REQUEST_TICKET_REOPEN, "variables", Map.of("input", input)))
                .post(CHAT_GRAPHQL)
                .then().statusCode(200)
                .extract().jsonPath().getList("errors", GraphqlError.class);
        return errors == null ? List.of() : errors;
    }

    public static Ticket createTicket(CreateTicketInput input) {
        return mutateTicket(CREATE_TICKET, "createTicket", Map.of("input", input));
    }

    public static List<TicketTag> getTicketTags() {
        Map<String, Object> body = Map.of("query", TICKET_TAGS);
        return given(getAuthorizedSpec())
                .body(body).post(CHAT_GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getList("data.ticketTags", TicketTag.class);
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
