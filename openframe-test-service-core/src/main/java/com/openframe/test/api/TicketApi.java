package com.openframe.test.api;

import com.openframe.test.data.dto.shared.CursorPaginationInput;
import com.openframe.test.data.dto.ticket.CreateTicketInput;
import com.openframe.test.data.dto.ticket.ReorderTicketInput;
import com.openframe.test.data.dto.ticket.Ticket;
import com.openframe.test.data.dto.ticket.TicketConnection;
import com.openframe.test.data.dto.ticket.TicketFilterInput;
import com.openframe.test.data.dto.ticket.TicketIdInput;
import com.openframe.test.data.dto.ticket.TicketLabel;
import com.openframe.test.data.dto.ticket.TicketUserError;
import io.restassured.path.json.JsonPath;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.test.api.graphql.TicketQueries.ARCHIVE_TICKET;
import static com.openframe.test.api.graphql.TicketQueries.CREATE_TICKET;
import static com.openframe.test.api.graphql.TicketQueries.GET_TICKET;
import static com.openframe.test.api.graphql.TicketQueries.GET_TICKETS;
import static com.openframe.test.api.graphql.TicketQueries.PUT_TICKET_ON_HOLD;
import static com.openframe.test.api.graphql.TicketQueries.REORDER_TICKET;
import static com.openframe.test.api.graphql.TicketQueries.RESOLVE_TICKET;
import static com.openframe.test.api.graphql.TicketQueries.TICKET_LABELS;
import static com.openframe.test.config.EnvironmentConfig.CHAT_GRAPHQL;
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

    public static Ticket archiveTicket(String id) {
        return mutateTicket(ARCHIVE_TICKET, "archiveTicket", Map.of("input", TicketIdInput.builder().id(id).build()));
    }

    public static List<TicketUserError> attemptArchiveTicket(String id) {
        return collectUserErrors(ARCHIVE_TICKET, "archiveTicket", Map.of("input", TicketIdInput.builder().id(id).build()));
    }

    public static Ticket reorderTicket(ReorderTicketInput input) {
        return mutateTicket(REORDER_TICKET, "reorderTicket", Map.of("input", input));
    }

    public static Ticket resolveTicket(String id) {
        return mutateTicket(RESOLVE_TICKET, "resolveTicket", Map.of("input", TicketIdInput.builder().id(id).build()));
    }

    public static Ticket putTicketOnHold(String id) {
        return mutateTicket(PUT_TICKET_ON_HOLD, "putTicketOnHold", Map.of("input", TicketIdInput.builder().id(id).build()));
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

    private static List<TicketUserError> collectUserErrors(String query, String mutationName, Map<String, Object> variables) {
        return given(getAuthorizedSpec())
                .body(Map.of("query", query, "variables", variables))
                .post(CHAT_GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getList("data." + mutationName + ".userErrors", TicketUserError.class);
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
