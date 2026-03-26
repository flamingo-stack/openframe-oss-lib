package com.openframe.api.controller;

import com.openframe.api.dto.organization.CreateOrganizationRequest;
import com.openframe.api.dto.organization.OrganizationResponse;
import com.openframe.api.dto.organization.UpdateOrganizationRequest;
import com.openframe.api.dto.organization.UpdateOrganizationStatusRequest;
import com.openframe.api.mapper.OrganizationMapper;
import com.openframe.api.service.OrganizationCommandService;
import com.openframe.data.service.OrganizationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * REST API Controller for Organization mutations (Create, Update, Delete).
 * Read operations are in external-api for public access.
 */
@RestController
@RequestMapping("/organizations")
@RequiredArgsConstructor
@Slf4j
public class OrganizationController {

    private final OrganizationService organizationService;
    private final OrganizationCommandService organizationCommandService;
    private final OrganizationMapper organizationMapper;

    /**
     * POST /organizations
     * Create a new organization.
     * 
     * @param request create organization request
     * @return created organization response
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrganizationResponse createOrganization(@Valid @RequestBody CreateOrganizationRequest request) {
        log.info("Internal API: Creating new organization: {}", request.name());
        var created = organizationCommandService.createOrganization(request);
        return organizationMapper.toResponse(created);
    }

    /**
     * PUT /organizations/{id}
     * Update an existing organization.
     * 
     * @param id organization ID
     * @param request update organization request
     * @return updated organization response
     */
    @PutMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    public OrganizationResponse updateOrganization(
            @PathVariable String id,
            @Valid @RequestBody UpdateOrganizationRequest request) {

        log.info("Internal API: Updating organization: {}", id);

        try {
            var updated = organizationCommandService.updateOrganization(id, request);
            return organizationMapper.toResponse(updated);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage());
        }
    }

    /**
     * GET /organizations/{id}/can-archive
     * Check if organization can be archived (no active devices linked).
     *
     * @param id organization ID
     * @return true if organization can be archived
     */
    @GetMapping("/{id}/can-archive")
    @ResponseStatus(HttpStatus.OK)
    public boolean canArchiveOrganization(@PathVariable String id) {
        return organizationService.canArchiveOrganization(id);
    }

    /**
     * PATCH /organizations/{id}/status
     * Update organization status (ACTIVE or ARCHIVED).
     * Archiving throws 409 Conflict if organization has active devices.
     *
     * @param id organization ID
     * @param request status update request
     */
    @PatchMapping("/{id}/status")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateOrganizationStatus(
            @PathVariable String id,
            @Valid @RequestBody UpdateOrganizationStatusRequest request) {
        log.info("Internal API: Updating organization {} status to {}", id, request.status());
        organizationCommandService.updateOrganizationStatus(id, request);
    }
}
