package com.openframe.api.controller;

import com.openframe.api.dto.organization.CreateOrganizationRequest;
import com.openframe.api.dto.organization.OrganizationResponse;
import com.openframe.api.dto.organization.UpdateOrganizationRequest;
import com.openframe.api.mapper.OrganizationMapper;
import com.openframe.api.service.OrganizationCommandService;
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
     * DELETE /organizations/{id}
     * Organization deletion is no longer supported. Use POST /organizations/{id}/archive instead.
     *
     * @param id organization ID
     * @deprecated Use POST /organizations/{id}/archive instead.
     */
    @Deprecated
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.METHOD_NOT_ALLOWED)
    public void deleteOrganization(@PathVariable String id) {
        throw new ResponseStatusException(HttpStatus.METHOD_NOT_ALLOWED,
                "Organization deletion is no longer supported. Use POST /organizations/" + id + "/archive instead.");
    }

    /**
     * POST /organizations/{id}/archive
     * Archive an organization.
     * Throws 409 Conflict if organization has non-deleted machines.
     *
     * @param id organization ID
     */
    @PostMapping("/{id}/archive")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void archiveOrganization(@PathVariable String id) {
        log.info("Internal API: Archiving organization: {}", id);
        organizationCommandService.archiveOrganization(id);
    }

    /**
     * POST /organizations/{id}/unarchive
     * Restore an archived organization back to ACTIVE status.
     *
     * @param id organization ID
     */
    @PostMapping("/{id}/unarchive")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unarchiveOrganization(@PathVariable String id) {
        log.info("Internal API: Unarchiving organization: {}", id);

        try {
            organizationCommandService.unarchiveOrganization(id);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage());
        }
    }
}
