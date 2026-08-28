package com.openframe.test.api.external;

import com.openframe.test.data.dto.external.common.ExternalErrorResponse;
import com.openframe.test.data.dto.external.ticket.AssignTicketRequest;
import com.openframe.test.data.dto.external.ticket.CreateTicketRequest;
import com.openframe.test.data.dto.external.ticket.TicketFiltersResponse;
import com.openframe.test.data.dto.external.ticket.TicketNoteRequest;
import com.openframe.test.data.dto.external.ticket.TicketNoteResponse;
import com.openframe.test.data.dto.external.ticket.TicketResponse;
import com.openframe.test.data.dto.external.ticket.TicketStatisticsResponse;
import com.openframe.test.data.dto.external.ticket.TicketStatusResponse;
import com.openframe.test.data.dto.external.ticket.TicketTagResponse;
import com.openframe.test.data.dto.external.ticket.TicketsResponse;
import com.openframe.test.data.dto.external.ticket.TransitionTicketRequest;
import com.openframe.test.data.dto.external.ticket.UpdateTicketRequest;
import io.restassured.response.Response;

import java.util.List;
import java.util.Map;

import static com.openframe.test.helpers.RequestSpecHelper.getExternalApiSpec;
import static io.restassured.RestAssured.given;

/**
 * External API client for {@code /api/v1/tickets} — the largest surface on the External API at 18
 * operations.
 *
 * <p>Tickets are the only External API resource whose controller resolves a real principal (from the
 * {@code X-User-Id} the gateway injects), so these endpoints act as a specific user where the device,
 * customer, log, and tool endpoints do not.
 *
 * <p>Note there is no delete: a ticket, once created, can only be transitioned. Teardown archives.
 */
public class ExternalTicketApi {

    private static final String TICKETS = "api/v1/tickets";
    private static final String FILTERS = TICKETS + "/filters";
    private static final String STATUSES = TICKETS + "/statuses";
    private static final String TAGS = TICKETS + "/tags";
    private static final String STATISTICS = TICKETS + "/statistics";
    private static final String BY_ID = TICKETS + "/{id}";
    private static final String ASSIGNEE = BY_ID + "/assignee";
    private static final String DEVICE = BY_ID + "/device";
    private static final String CUSTOMER = BY_ID + "/customer";
    private static final String TRANSITION = BY_ID + "/transition";
    private static final String NOTES = BY_ID + "/notes";
    private static final String NOTE_BY_ID = NOTES + "/{noteId}";
    private static final String TAG_BY_ID = BY_ID + "/tags/{tagId}";

    // --- reads -------------------------------------------------------------------------------

    public static TicketsResponse listTickets() {
        return listTickets(Map.of());
    }

    public static TicketsResponse listTickets(Map<String, Object> queryParams) {
        return given(getExternalApiSpec())
                .queryParams(queryParams)
                .get(TICKETS)
                .then().statusCode(200)
                .extract().as(TicketsResponse.class);
    }

    public static Response listTicketsRaw(Map<String, Object> queryParams) {
        return given(getExternalApiSpec()).queryParams(queryParams).get(TICKETS);
    }

    public static TicketFiltersResponse getFilters() {
        return getFilters(Map.of());
    }

    public static TicketFiltersResponse getFilters(Map<String, Object> queryParams) {
        return given(getExternalApiSpec())
                .queryParams(queryParams)
                .get(FILTERS)
                .then().statusCode(200)
                .extract().as(TicketFiltersResponse.class);
    }

    /** Lifecycle statuses in board order. */
    public static List<TicketStatusResponse> getStatuses() {
        return given(getExternalApiSpec())
                .get(STATUSES)
                .then().statusCode(200)
                .extract().jsonPath().getList(".", TicketStatusResponse.class);
    }

    public static List<TicketTagResponse> getTags() {
        return given(getExternalApiSpec())
                .get(TAGS)
                .then().statusCode(200)
                .extract().jsonPath().getList(".", TicketTagResponse.class);
    }

    public static TicketStatisticsResponse getStatistics() {
        return given(getExternalApiSpec())
                .get(STATISTICS)
                .then().statusCode(200)
                .extract().as(TicketStatisticsResponse.class);
    }

    public static TicketResponse getTicket(String id) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .get(BY_ID)
                .then().statusCode(200)
                .extract().as(TicketResponse.class);
    }

    public static ExternalErrorResponse attemptGetTicket(String id, int expectedStatus) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .get(BY_ID)
                .then().statusCode(expectedStatus)
                .extract().as(ExternalErrorResponse.class);
    }

    // --- writes ------------------------------------------------------------------------------

    public static TicketResponse createTicket(CreateTicketRequest request) {
        return given(getExternalApiSpec())
                .body(request)
                .post(TICKETS)
                .then().statusCode(201)
                .extract().as(TicketResponse.class);
    }

    public static ExternalErrorResponse attemptCreateTicket(CreateTicketRequest request, int expectedStatus) {
        return given(getExternalApiSpec())
                .body(request)
                .post(TICKETS)
                .then().statusCode(expectedStatus)
                .extract().as(ExternalErrorResponse.class);
    }

    public static TicketResponse updateTicket(String id, UpdateTicketRequest request) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .body(request)
                .patch(BY_ID)
                .then().statusCode(200)
                .extract().as(TicketResponse.class);
    }

    public static TicketResponse assign(String id, String assigneeId) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .body(AssignTicketRequest.builder().assigneeId(assigneeId).build())
                .put(ASSIGNEE)
                .then().statusCode(200)
                .extract().as(TicketResponse.class);
    }

    public static TicketResponse unassign(String id) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .delete(ASSIGNEE)
                .then().statusCode(200)
                .extract().as(TicketResponse.class);
    }

    public static TicketResponse unlinkDevice(String id) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .delete(DEVICE)
                .then().statusCode(200)
                .extract().as(TicketResponse.class);
    }

    public static TicketResponse unlinkCustomer(String id) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .delete(CUSTOMER)
                .then().statusCode(200)
                .extract().as(TicketResponse.class);
    }

    public static TicketResponse transition(String id, String toStatusId, String reason) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .body(TransitionTicketRequest.builder().toStatusId(toStatusId).reason(reason).build())
                .post(TRANSITION)
                .then().statusCode(200)
                .extract().as(TicketResponse.class);
    }

    public static Response transitionRaw(String id, String toStatusId, String reason) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .body(TransitionTicketRequest.builder().toStatusId(toStatusId).reason(reason).build())
                .post(TRANSITION);
    }

    public static TicketResponse addTag(String id, String tagId) {
        return given(getExternalApiSpec())
                .pathParams("id", id, "tagId", tagId)
                .post(TAG_BY_ID)
                .then().statusCode(200)
                .extract().as(TicketResponse.class);
    }

    public static TicketResponse removeTag(String id, String tagId) {
        return given(getExternalApiSpec())
                .pathParams("id", id, "tagId", tagId)
                .delete(TAG_BY_ID)
                .then().statusCode(200)
                .extract().as(TicketResponse.class);
    }

    // --- notes -------------------------------------------------------------------------------

    public static TicketNoteResponse addNote(String id, String content) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .body(TicketNoteRequest.builder().content(content).build())
                .post(NOTES)
                .then().statusCode(201)
                .extract().as(TicketNoteResponse.class);
    }

    public static TicketNoteResponse updateNote(String id, String noteId, String content) {
        return given(getExternalApiSpec())
                .pathParams("id", id, "noteId", noteId)
                .body(TicketNoteRequest.builder().content(content).build())
                .put(NOTE_BY_ID)
                .then().statusCode(200)
                .extract().as(TicketNoteResponse.class);
    }

    /** 204 No Content. Author-only on the backend. */
    public static void deleteNote(String id, String noteId) {
        given(getExternalApiSpec())
                .pathParams("id", id, "noteId", noteId)
                .delete(NOTE_BY_ID)
                .then().statusCode(204);
    }

    public static Response deleteNoteRaw(String id, String noteId) {
        return given(getExternalApiSpec())
                .pathParams("id", id, "noteId", noteId)
                .delete(NOTE_BY_ID);
    }
}
