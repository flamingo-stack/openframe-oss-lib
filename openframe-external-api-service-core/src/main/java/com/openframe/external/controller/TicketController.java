package com.openframe.external.controller;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.dto.ticket.CreateTicketInput;
import com.openframe.api.dto.ticket.TicketFilterInput;
import com.openframe.api.dto.ticket.TransitionTicketInput;
import com.openframe.api.dto.ticket.UpdateTicketInput;
import com.openframe.api.exception.ticket.TicketNotFoundException;
import com.openframe.api.service.ticket.*;
import com.openframe.core.dto.ErrorResponse;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketStatus;
import com.openframe.external.dto.ticket.*;
import com.openframe.external.mapper.TicketMapper;
import com.openframe.external.security.ApiKeyPrincipalResolver;
import com.openframe.external.service.TicketReadService;
import com.openframe.security.authentication.AuthPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static com.openframe.core.constants.HttpHeaders.X_API_KEY_ID;
import static com.openframe.core.constants.HttpHeaders.X_USER_ID;
import static org.springframework.http.HttpStatus.*;

/**
 * External REST API for tickets. Runs the shared ticket domain services (openframe-api-lib) on
 * behalf of the API key owner, so behaviour — numbering, lifecycle rules, notifications — is the
 * same as in the dashboard. Active on deployments with {@code openframe.features.tickets.enabled}.
 */
@RestController
@RequestMapping("/api/v1/tickets")
@RequiredArgsConstructor
@Slf4j
@Validated
@Tag(name = "Tickets API v1", description = "Ticket management endpoints")
@ConditionalOnProperty(name = TicketFeature.ENABLED, havingValue = "true")
public class TicketController {

    private final TicketService ticketService;
    private final TicketFilterService ticketFilterService;
    private final TicketStatusService ticketStatusService;
    private final TicketTagService ticketTagService;
    private final TicketNoteService ticketNoteService;
    private final TicketStatisticsService ticketStatisticsService;
    private final ObjectProvider<TicketLifecycleService> lifecycleProvider;
    private final TicketReadService ticketReadService;
    private final TicketMapper ticketMapper;
    private final ApiKeyPrincipalResolver principalResolver;

    @Operation(summary = "Get list of tickets",
            description = "Retrieve a cursor-paginated list of tickets with optional filtering, search and sorting. " +
                    "Cursors are ticket ids taken from pageInfo.endCursor.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Successfully retrieved tickets",
                    content = @Content(schema = @Schema(implementation = TicketsResponse.class))),
            @ApiResponse(responseCode = "400", description = "Invalid request parameters",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Unauthorized - invalid or missing API key",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping
    @ResponseStatus(OK)
    public TicketsResponse getTickets(
            @Parameter(description = "Legacy statuses to filter by (tenants without the custom-status lifecycle)")
            @RequestParam(required = false) List<TicketStatus> statuses,
            @Parameter(description = "Lifecycle status ids to filter by (see /statuses)")
            @RequestParam(required = false) List<String> statusIds,
            @Parameter(description = "Organization IDs to filter by")
            @RequestParam(required = false) List<String> organizationIds,
            @Parameter(description = "Assignee user IDs to filter by")
            @RequestParam(required = false) List<String> assigneeIds,
            @Parameter(description = "Tag ids to filter by (see /tags)")
            @RequestParam(required = false) List<String> tagIds,
            @Parameter(description = "Search in title, description, ticket number, device, organization and assignee")
            @RequestParam(required = false) String search,
            @Parameter(description = "Maximum number of items to return (default: 20, max: 100)")
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) Integer limit,
            @Parameter(description = "Cursor for pagination (ticket id from pageInfo.endCursor)")
            @RequestParam(required = false) String cursor,
            @Parameter(description = "Field to sort by (e.g. createdAt, updatedAt, ticketNumber, statusKind, organizationName, assignedName, deviceHostname)")
            @RequestParam(required = false) String sortField,
            @Parameter(description = "Sort direction (ASC or DESC), default: DESC")
            @RequestParam(required = false, defaultValue = "DESC") String sortDirection,
            @Parameter(hidden = true) @RequestHeader(X_USER_ID) String userId,
            @Parameter(hidden = true) @RequestHeader(value = X_API_KEY_ID, required = false) String apiKeyId) {

        log.info("Getting tickets - userId: {}, apiKeyId: {}, limit: {}, cursor: {}, search: {}, sortField: {}, sortDirection: {}",
                userId, apiKeyId, limit, cursor, search, sortField, sortDirection);

        AuthPrincipal principal = principalResolver.resolve(userId);
        CountedGenericQueryResult<Ticket> result = ticketService.getTickets(
                principal,
                filter(statuses, statusIds, organizationIds, assigneeIds, tagIds),
                CursorPaginationCriteria.builder().cursor(cursor).limit(limit).build(),
                search,
                SortInput.from(sortField, sortDirection));
        return ticketMapper.toTicketsResponse(result, ticketReadService.toResponses(principal, result.getItems()));
    }

    @Operation(summary = "Get ticket filter options",
            description = "Retrieve the available status, organization, assignee and tag filter values")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Filter options retrieved successfully",
                    content = @Content(schema = @Schema(implementation = TicketFiltersResponse.class)))
    })
    @GetMapping("/filters")
    @ResponseStatus(OK)
    public TicketFiltersResponse getTicketFilters(
            @RequestParam(required = false) List<TicketStatus> statuses,
            @RequestParam(required = false) List<String> statusIds,
            @RequestParam(required = false) List<String> organizationIds,
            @RequestParam(required = false) List<String> assigneeIds,
            @RequestParam(required = false) List<String> tagIds,
            @Parameter(hidden = true) @RequestHeader(X_USER_ID) String userId,
            @Parameter(hidden = true) @RequestHeader(value = X_API_KEY_ID, required = false) String apiKeyId) {

        log.info("Getting ticket filters - userId: {}, apiKeyId: {}", userId, apiKeyId);
        AuthPrincipal principal = principalResolver.resolve(userId);
        return ticketMapper.toFiltersResponse(ticketFilterService.getFilters(
                principal, filter(statuses, statusIds, organizationIds, assigneeIds, tagIds)).join());
    }

    @Operation(summary = "Get ticket statuses",
            description = "Retrieve the tenant's ticket lifecycle statuses (system and custom) in board order")
    @GetMapping("/statuses")
    @ResponseStatus(OK)
    public List<TicketStatusResponse> getTicketStatuses(
            @Parameter(hidden = true) @RequestHeader(X_USER_ID) String userId,
            @Parameter(hidden = true) @RequestHeader(value = X_API_KEY_ID, required = false) String apiKeyId) {

        log.info("Getting ticket statuses - userId: {}, apiKeyId: {}", userId, apiKeyId);
        principalResolver.resolve(userId);
        return ticketMapper.toStatusResponses(ticketStatusService.list());
    }

    @Operation(summary = "Get ticket tags", description = "Retrieve the tags available for tickets")
    @GetMapping("/tags")
    @ResponseStatus(OK)
    public List<TicketTagResponse> getTicketTags(
            @Parameter(hidden = true) @RequestHeader(X_USER_ID) String userId,
            @Parameter(hidden = true) @RequestHeader(value = X_API_KEY_ID, required = false) String apiKeyId) {

        log.info("Getting ticket tags - userId: {}, apiKeyId: {}", userId, apiKeyId);
        AuthPrincipal principal = principalResolver.resolve(userId);
        return ticketMapper.toTagResponses(ticketTagService.getTags(principal));
    }

    @Operation(summary = "Get ticket statistics", description = "Retrieve ticket counts per status and resolution metrics")
    @GetMapping("/statistics")
    @ResponseStatus(OK)
    public TicketStatisticsResponse getTicketStatistics(
            @Parameter(hidden = true) @RequestHeader(X_USER_ID) String userId,
            @Parameter(hidden = true) @RequestHeader(value = X_API_KEY_ID, required = false) String apiKeyId) {

        log.info("Getting ticket statistics - userId: {}, apiKeyId: {}", userId, apiKeyId);
        AuthPrincipal principal = principalResolver.resolve(userId);
        return ticketMapper.toStatisticsResponse(ticketStatisticsService.getStatistics(principal));
    }

    @Operation(summary = "Get ticket by ID", description = "Retrieve a single ticket with its tags, notes and attachments")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Ticket found",
                    content = @Content(schema = @Schema(implementation = TicketResponse.class))),
            @ApiResponse(responseCode = "404", description = "Ticket not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping("/{id}")
    @ResponseStatus(OK)
    public TicketResponse getTicket(
            @Parameter(description = "Ticket ID") @PathVariable String id,
            @Parameter(hidden = true) @RequestHeader(X_USER_ID) String userId,
            @Parameter(hidden = true) @RequestHeader(value = X_API_KEY_ID, required = false) String apiKeyId) {

        log.info("Getting ticket {} - userId: {}, apiKeyId: {}", id, userId, apiKeyId);
        AuthPrincipal principal = principalResolver.resolve(userId);
        Ticket ticket = ticketService.getTicket(principal, id)
                .orElseThrow(() -> new TicketNotFoundException(id));
        return ticketReadService.toResponse(principal, ticket);
    }

    @Operation(summary = "Create a ticket",
            description = "Create a ticket on behalf of the API key owner, exactly as from the dashboard: the ticket gets " +
                    "the next ticket number, lands in the requested (or first custom) status and the assignee is notified.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Ticket created",
                    content = @Content(schema = @Schema(implementation = TicketResponse.class))),
            @ApiResponse(responseCode = "400", description = "Validation error",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping
    @ResponseStatus(CREATED)
    public TicketResponse createTicket(
            @Valid @RequestBody CreateTicketRequest request,
            @Parameter(hidden = true) @RequestHeader(X_USER_ID) String userId,
            @Parameter(hidden = true) @RequestHeader(value = X_API_KEY_ID, required = false) String apiKeyId) {

        log.info("Creating ticket '{}' - userId: {}, apiKeyId: {}", request.title(), userId, apiKeyId);
        AuthPrincipal principal = principalResolver.resolve(userId);
        CreateTicketInput input = CreateTicketInput.builder()
                .title(request.title())
                .description(request.description())
                .statusId(request.statusId())
                .deviceId(request.deviceId())
                .organizationId(request.organizationId())
                .assigneeId(request.assigneeId())
                .tagIds(request.tagIds())
                .build();
        return ticketReadService.toResponse(principal, ticketService.createTicket(principal, input));
    }

    @Operation(summary = "Update a ticket",
            description = "Partially update title, description, linked device/organization, assignee and tags. " +
                    "Use the transition endpoint to change the status.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Ticket updated",
                    content = @Content(schema = @Schema(implementation = TicketResponse.class))),
            @ApiResponse(responseCode = "400", description = "Validation error",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PatchMapping("/{id}")
    @ResponseStatus(OK)
    public TicketResponse updateTicket(
            @Parameter(description = "Ticket ID") @PathVariable String id,
            @Valid @RequestBody UpdateTicketRequest request,
            @Parameter(hidden = true) @RequestHeader(X_USER_ID) String userId,
            @Parameter(hidden = true) @RequestHeader(value = X_API_KEY_ID, required = false) String apiKeyId) {

        log.info("Updating ticket {} - userId: {}, apiKeyId: {}", id, userId, apiKeyId);
        AuthPrincipal principal = principalResolver.resolve(userId);
        UpdateTicketInput input = UpdateTicketInput.builder()
                .id(id)
                .title(request.title())
                .description(request.description())
                .deviceId(request.deviceId())
                .organizationId(request.organizationId())
                .assigneeId(request.assigneeId())
                .tagIds(request.tagIds())
                .build();
        return ticketReadService.toResponse(principal, ticketService.updateTicket(principal, id, input));
    }

    @Operation(summary = "Transition a ticket to another status",
            description = "Move the ticket to one of its availableTransitions. Resolving stamps resolvedAt/resolvedBy; " +
                    "leaving AI assistance hands the conversation over to a technician.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Ticket transitioned",
                    content = @Content(schema = @Schema(implementation = TicketResponse.class))),
            @ApiResponse(responseCode = "404", description = "Ticket or status not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "409", description = "Transition not allowed from the current status",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/{id}/transition")
    @ResponseStatus(OK)
    public TicketResponse transitionTicket(
            @Parameter(description = "Ticket ID") @PathVariable String id,
            @Valid @RequestBody TransitionTicketRequest request,
            @Parameter(hidden = true) @RequestHeader(X_USER_ID) String userId,
            @Parameter(hidden = true) @RequestHeader(value = X_API_KEY_ID, required = false) String apiKeyId) {

        log.info("Transitioning ticket {} to status {} - userId: {}, apiKeyId: {}", id, request.toStatusId(), userId, apiKeyId);
        AuthPrincipal principal = principalResolver.resolve(userId);
        TicketLifecycleService lifecycle = lifecycleProvider.getIfAvailable();
        if (lifecycle == null) {
            throw new IllegalStateException("Ticket lifecycle is not enabled for this tenant");
        }
        TransitionTicketInput input = TransitionTicketInput.builder()
                .ticketId(id)
                .toStatusId(request.toStatusId())
                .reason(request.reason())
                .build();
        return ticketReadService.toResponse(principal, lifecycle.transition(principal, input));
    }

    @Operation(summary = "Assign a ticket", description = "Assign the ticket to a user (the assignee is notified)")
    @PutMapping("/{id}/assignee")
    @ResponseStatus(OK)
    public TicketResponse assignTicket(
            @Parameter(description = "Ticket ID") @PathVariable String id,
            @Valid @RequestBody AssignTicketRequest request,
            @Parameter(hidden = true) @RequestHeader(X_USER_ID) String userId,
            @Parameter(hidden = true) @RequestHeader(value = X_API_KEY_ID, required = false) String apiKeyId) {

        log.info("Assigning ticket {} to {} - userId: {}, apiKeyId: {}", id, request.assigneeId(), userId, apiKeyId);
        AuthPrincipal principal = principalResolver.resolve(userId);
        return ticketReadService.toResponse(principal, ticketService.assignTicket(principal, id, request.assigneeId()));
    }

    @Operation(summary = "Unassign a ticket", description = "Remove the current assignee")
    @DeleteMapping("/{id}/assignee")
    @ResponseStatus(OK)
    public TicketResponse unassignTicket(
            @Parameter(description = "Ticket ID") @PathVariable String id,
            @Parameter(hidden = true) @RequestHeader(X_USER_ID) String userId,
            @Parameter(hidden = true) @RequestHeader(value = X_API_KEY_ID, required = false) String apiKeyId) {

        log.info("Unassigning ticket {} - userId: {}, apiKeyId: {}", id, userId, apiKeyId);
        AuthPrincipal principal = principalResolver.resolve(userId);
        return ticketReadService.toResponse(principal, ticketService.unassignTicket(principal, id));
    }

    @Operation(summary = "Unlink the device", description = "Remove the linked device from the ticket")
    @DeleteMapping("/{id}/device")
    @ResponseStatus(OK)
    public TicketResponse unlinkDevice(
            @Parameter(description = "Ticket ID") @PathVariable String id,
            @Parameter(hidden = true) @RequestHeader(X_USER_ID) String userId,
            @Parameter(hidden = true) @RequestHeader(value = X_API_KEY_ID, required = false) String apiKeyId) {

        log.info("Unlinking device from ticket {} - userId: {}, apiKeyId: {}", id, userId, apiKeyId);
        AuthPrincipal principal = principalResolver.resolve(userId);
        return ticketReadService.toResponse(principal, ticketService.unlinkDeviceFromTicket(principal, id));
    }

    @Operation(summary = "Unlink the organization",
            description = "Remove the linked organization (and, as a consequence, the linked device) from the ticket")
    @DeleteMapping("/{id}/organization")
    @ResponseStatus(OK)
    public TicketResponse unlinkOrganization(
            @Parameter(description = "Ticket ID") @PathVariable String id,
            @Parameter(hidden = true) @RequestHeader(X_USER_ID) String userId,
            @Parameter(hidden = true) @RequestHeader(value = X_API_KEY_ID, required = false) String apiKeyId) {

        log.info("Unlinking organization from ticket {} - userId: {}, apiKeyId: {}", id, userId, apiKeyId);
        AuthPrincipal principal = principalResolver.resolve(userId);
        return ticketReadService.toResponse(principal, ticketService.unlinkOrganizationFromTicket(principal, id));
    }

    @Operation(summary = "Add a tag to a ticket")
    @PostMapping("/{id}/tags/{tagId}")
    @ResponseStatus(OK)
    public TicketResponse addTag(
            @Parameter(description = "Ticket ID") @PathVariable String id,
            @Parameter(description = "Tag ID (see /tags)") @PathVariable String tagId,
            @Parameter(hidden = true) @RequestHeader(X_USER_ID) String userId,
            @Parameter(hidden = true) @RequestHeader(value = X_API_KEY_ID, required = false) String apiKeyId) {

        log.info("Adding tag {} to ticket {} - userId: {}, apiKeyId: {}", tagId, id, userId, apiKeyId);
        AuthPrincipal principal = principalResolver.resolve(userId);
        ticketTagService.addTagToTicket(principal, id, tagId);
        return getTicket(id, userId, apiKeyId);
    }

    @Operation(summary = "Remove a tag from a ticket")
    @DeleteMapping("/{id}/tags/{tagId}")
    @ResponseStatus(OK)
    public TicketResponse removeTag(
            @Parameter(description = "Ticket ID") @PathVariable String id,
            @Parameter(description = "Tag ID") @PathVariable String tagId,
            @Parameter(hidden = true) @RequestHeader(X_USER_ID) String userId,
            @Parameter(hidden = true) @RequestHeader(value = X_API_KEY_ID, required = false) String apiKeyId) {

        log.info("Removing tag {} from ticket {} - userId: {}, apiKeyId: {}", tagId, id, userId, apiKeyId);
        AuthPrincipal principal = principalResolver.resolve(userId);
        ticketTagService.removeTagFromTicket(principal, id, tagId);
        return getTicket(id, userId, apiKeyId);
    }

    @Operation(summary = "Add an internal note to a ticket")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Note created",
                    content = @Content(schema = @Schema(implementation = TicketNoteResponse.class)))
    })
    @PostMapping("/{id}/notes")
    @ResponseStatus(CREATED)
    public TicketNoteResponse addNote(
            @Parameter(description = "Ticket ID") @PathVariable String id,
            @Valid @RequestBody TicketNoteRequest request,
            @Parameter(hidden = true) @RequestHeader(X_USER_ID) String userId,
            @Parameter(hidden = true) @RequestHeader(value = X_API_KEY_ID, required = false) String apiKeyId) {

        log.info("Adding note to ticket {} - userId: {}, apiKeyId: {}", id, userId, apiKeyId);
        AuthPrincipal principal = principalResolver.resolve(userId);
        return ticketMapper.toNoteResponse(ticketNoteService.addNote(principal, id, request.content()));
    }

    @Operation(summary = "Update a ticket note", description = "Only the note author can edit it")
    @PutMapping("/{id}/notes/{noteId}")
    @ResponseStatus(OK)
    public TicketNoteResponse updateNote(
            @Parameter(description = "Ticket ID") @PathVariable String id,
            @Parameter(description = "Note ID") @PathVariable String noteId,
            @Valid @RequestBody TicketNoteRequest request,
            @Parameter(hidden = true) @RequestHeader(X_USER_ID) String userId,
            @Parameter(hidden = true) @RequestHeader(value = X_API_KEY_ID, required = false) String apiKeyId) {

        log.info("Updating note {} on ticket {} - userId: {}, apiKeyId: {}", noteId, id, userId, apiKeyId);
        AuthPrincipal principal = principalResolver.resolve(userId);
        return ticketMapper.toNoteResponse(ticketNoteService.updateNote(principal, noteId, request.content()));
    }

    @Operation(summary = "Delete a ticket note", description = "Only the note author can delete it")
    @DeleteMapping("/{id}/notes/{noteId}")
    @ResponseStatus(NO_CONTENT)
    public void deleteNote(
            @Parameter(description = "Ticket ID") @PathVariable String id,
            @Parameter(description = "Note ID") @PathVariable String noteId,
            @Parameter(hidden = true) @RequestHeader(X_USER_ID) String userId,
            @Parameter(hidden = true) @RequestHeader(value = X_API_KEY_ID, required = false) String apiKeyId) {

        log.info("Deleting note {} on ticket {} - userId: {}, apiKeyId: {}", noteId, id, userId, apiKeyId);
        AuthPrincipal principal = principalResolver.resolve(userId);
        ticketNoteService.deleteNote(principal, noteId);
    }

    private static TicketFilterInput filter(List<TicketStatus> statuses, List<String> statusIds,
                                            List<String> organizationIds, List<String> assigneeIds, List<String> tagIds) {
        return TicketFilterInput.builder()
                .statuses(statuses)
                .statusIds(statusIds)
                .organizationIds(organizationIds)
                .assigneeIds(assigneeIds)
                .tagIds(tagIds)
                .build();
    }
}
