package com.openframe.api.controller;

import com.openframe.api.dto.organization.CreateOrganizationRequest;
import com.openframe.api.dto.organization.UpdateOrganizationRequest;
import com.openframe.api.service.OrganizationCommandService;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.exception.OrganizationHasMachinesException;
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

    /**
     * POST /organizations
     * Create a new organization.
     * 
     * @param request create organization request
     * @return created organization
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Organization createOrganization(@Valid @RequestBody CreateOrganizationRequest request) {
        log.info("Internal API: Creating new organization: {}", request.name());
        return organizationCommandService.createOrganization(request);
    }

    /**
     * PUT /organizations/{id}
     * Update an existing organization.
     * 
     * @param id organization ID
     * @param request update organization request
     * @return updated organization
     */
    @PutMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    public Organization updateOrganization(
            @PathVariable String id,
            @Valid @RequestBody UpdateOrganizationRequest request) {

        log.info("Internal API: Updating organization: {}", id);

        try {
            return organizationCommandService.updateOrganization(id, request);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage());
        }
    }

    /**
     * DELETE /organizations/{id}
     * Delete an organization.
     * Throws 409 Conflict if organization has associated machines.
     * 
     * @param id organization ID
     */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteOrganization(@PathVariable String id) {
        log.info("Internal API: Deleting organization: {}", id);

        try {
            organizationCommandService.deleteOrganization(id);
        } catch (OrganizationHasMachinesException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage());
        }
    }
}
