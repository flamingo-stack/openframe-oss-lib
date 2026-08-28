package com.openframe.external.controller;

import com.openframe.api.dto.organization.OrganizationFilterOptions;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.service.organization.OrganizationCommandService;
import com.openframe.api.service.organization.OrganizationQueryService;
import com.openframe.core.dto.ErrorResponse;
import com.openframe.data.service.OrganizationService;
import com.openframe.external.dto.customer.CreateCustomerRequest;
import com.openframe.external.dto.customer.CustomerResponse;
import com.openframe.external.dto.customer.CustomersResponse;
import com.openframe.external.dto.customer.UpdateCustomerRequest;
import com.openframe.external.dto.customer.UpdateCustomerStatusRequest;
import com.openframe.external.exception.CustomerNotFoundException;
import com.openframe.external.mapper.CustomerMapper;
import com.openframe.external.util.ExternalCursors;
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
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;

import static org.springframework.http.HttpStatus.*;

/**
 * External REST API for customers (the organization domain under its product name). The customer
 * id used everywhere in this API is the business identifier — the internal database id is never
 * exposed, so there is exactly one id concept in the contract.
 */
@RestController
@RequestMapping("/api/v1/customers")
@RequiredArgsConstructor
@Slf4j
@Validated
@Tag(name = "Customers API v1", description = "Customer management endpoints")
public class CustomerController {

    private final OrganizationService organizationService;
    private final OrganizationQueryService organizationQueryService;
    private final OrganizationCommandService organizationCommandService;
    private final CustomerMapper customerMapper;

    @Operation(summary = "Get list of customers",
            description = "Retrieve a cursor-paginated list of customers with optional filtering and search")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Successfully retrieved customers",
                    content = @Content(schema = @Schema(implementation = CustomersResponse.class))),
            @ApiResponse(responseCode = "400", description = "Invalid request parameters or cursor",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Unauthorized - invalid or missing API key",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping
    @ResponseStatus(OK)
    public CustomersResponse getCustomers(
            @Parameter(description = "Filter by category")
            @RequestParam(required = false) String category,
            @Parameter(description = "Minimum number of employees")
            @RequestParam(required = false) Integer minEmployees,
            @Parameter(description = "Maximum number of employees")
            @RequestParam(required = false) Integer maxEmployees,
            @Parameter(description = "Filter by active contract status")
            @RequestParam(required = false) Boolean hasActiveContract,
            @Parameter(description = "Filter by customer status (ACTIVE or ARCHIVED). Defaults to ACTIVE.")
            @RequestParam(required = false) String status,
            @Parameter(description = "Inclusive lower bound of the last-activity range (ISO-8601 instant, UTC). Matches updatedAt; never-updated customers are not matched.")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant lastActivityFrom,
            @Parameter(description = "Inclusive upper bound of the last-activity range (ISO-8601 instant, UTC). Matches updatedAt; never-updated customers are not matched.")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant lastActivityTo,
            @Parameter(description = "Search query for customer name and category")
            @RequestParam(required = false) String search,
            @Parameter(description = "Maximum number of items to return (default: 20, max: 100)")
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) Integer limit,
            @Parameter(description = "Cursor for pagination (from pageInfo.endCursor). An unreadable cursor is rejected with 400.")
            @RequestParam(required = false) String cursor,
            @Parameter(description = "Field to sort by (name, createdAt, updatedAt)")
            @RequestParam(required = false) String sortField,
            @Parameter(description = "Sort direction (ASC or DESC), default: DESC")
            @RequestParam(required = false) String sortDirection,
            @Parameter(hidden = true) @RequestHeader(value = "X-User-Id", required = false) String userId,
            @Parameter(hidden = true) @RequestHeader(value = "X-API-Key-Id", required = false) String apiKeyId) {

        log.info("Getting customers - category: {}, status: {}, search: {}, limit: {}, cursor: {}, sortField: {}, sortDirection: {} - userId: {}, apiKeyId: {}",
                category, status, search, limit, cursor, sortField, sortDirection, userId, apiKeyId);

        OrganizationFilterOptions filterOptions = OrganizationFilterOptions.builder()
                .category(category)
                .minEmployees(minEmployees)
                .maxEmployees(maxEmployees)
                .hasActiveContract(hasActiveContract)
                .status(status)
                .lastActivityFrom(lastActivityFrom)
                .lastActivityTo(lastActivityTo)
                .build();

        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder()
                .cursor(ExternalCursors.decodeBase64(cursor))
                .limit(limit)
                .build();

        var result = organizationQueryService.queryOrganizations(
                filterOptions, pagination, search, SortInput.from(sortField, sortDirection));
        return customerMapper.toCustomersResponse(result);
    }

    @Operation(summary = "Get customer by id",
            description = "Retrieve a single customer by its id (the same value returned as 'id' in customer payloads)")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Successfully retrieved customer",
                    content = @Content(schema = @Schema(implementation = CustomerResponse.class))),
            @ApiResponse(responseCode = "404", description = "Customer not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping("/{id}")
    @ResponseStatus(OK)
    public CustomerResponse getCustomer(
            @Parameter(description = "Customer id", required = true) @PathVariable String id,
            @Parameter(hidden = true) @RequestHeader(value = "X-User-Id", required = false) String userId,
            @Parameter(hidden = true) @RequestHeader(value = "X-API-Key-Id", required = false) String apiKeyId) {

        log.info("Getting customer by id: {} - userId: {}, apiKeyId: {}", id, userId, apiKeyId);

        var organization = organizationService.getOrganizationByOrganizationId(id)
                .orElseThrow(() -> new CustomerNotFoundException(id));
        return customerMapper.toResponse(organization);
    }

    @Operation(summary = "Create a new customer")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Customer created successfully",
                    content = @Content(schema = @Schema(implementation = CustomerResponse.class))),
            @ApiResponse(responseCode = "400", description = "Invalid request body or validation error",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping
    @ResponseStatus(CREATED)
    public CustomerResponse createCustomer(
            @Valid @RequestBody CreateCustomerRequest request,
            @Parameter(hidden = true) @RequestHeader(value = "X-User-Id", required = false) String userId,
            @Parameter(hidden = true) @RequestHeader(value = "X-API-Key-Id", required = false) String apiKeyId) {

        log.info("Creating customer: {} - userId: {}, apiKeyId: {}", request.name(), userId, apiKeyId);

        var created = organizationCommandService.createOrganization(customerMapper.toCreateRequest(request));
        return customerMapper.toResponse(created);
    }

    @Operation(summary = "Update an existing customer",
            description = "Partially update a customer by id; only non-null fields are applied")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Customer updated successfully",
                    content = @Content(schema = @Schema(implementation = CustomerResponse.class))),
            @ApiResponse(responseCode = "404", description = "Customer not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PutMapping("/{id}")
    @ResponseStatus(OK)
    public CustomerResponse updateCustomer(
            @Parameter(description = "Customer id", required = true) @PathVariable String id,
            @Valid @RequestBody UpdateCustomerRequest request,
            @Parameter(hidden = true) @RequestHeader(value = "X-User-Id", required = false) String userId,
            @Parameter(hidden = true) @RequestHeader(value = "X-API-Key-Id", required = false) String apiKeyId) {

        log.info("Updating customer: {} - userId: {}, apiKeyId: {}", id, userId, apiKeyId);

        try {
            var updated = organizationCommandService.updateOrganization(id, customerMapper.toUpdateRequest(request));
            return customerMapper.toResponse(updated);
        } catch (IllegalArgumentException e) {
            throw new CustomerNotFoundException(id);
        }
    }

    @Operation(summary = "Check if customer can be archived",
            description = "Returns true if all devices of the customer are archived or deleted")
    @GetMapping("/{id}/can-archive")
    @ResponseStatus(OK)
    public boolean canArchiveCustomer(
            @Parameter(description = "Customer id", required = true) @PathVariable String id,
            @Parameter(hidden = true) @RequestHeader(value = "X-User-Id", required = false) String userId,
            @Parameter(hidden = true) @RequestHeader(value = "X-API-Key-Id", required = false) String apiKeyId) {

        log.info("Checking if customer {} can be archived - userId: {}, apiKeyId: {}", id, userId, apiKeyId);
        return organizationService.canArchiveOrganization(id);
    }

    @Operation(summary = "Update customer status",
            description = "Set status to ACTIVE or ARCHIVED. Archiving is blocked while the customer has active devices.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Customer status updated successfully"),
            @ApiResponse(responseCode = "404", description = "Customer not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "409", description = "Cannot archive customer with active devices",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PatchMapping("/{id}/status")
    @ResponseStatus(NO_CONTENT)
    public void updateCustomerStatus(
            @Parameter(description = "Customer id", required = true) @PathVariable String id,
            @Valid @RequestBody UpdateCustomerStatusRequest request,
            @Parameter(hidden = true) @RequestHeader(value = "X-User-Id", required = false) String userId,
            @Parameter(hidden = true) @RequestHeader(value = "X-API-Key-Id", required = false) String apiKeyId) {

        log.info("Updating customer {} status to {} - userId: {}, apiKeyId: {}", id, request.status(), userId, apiKeyId);
        organizationCommandService.updateOrganizationStatus(id, customerMapper.toStatusRequest(request));
    }
}
