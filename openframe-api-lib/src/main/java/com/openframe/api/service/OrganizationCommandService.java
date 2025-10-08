package com.openframe.api.service;

import com.openframe.api.dto.organization.CreateOrganizationRequest;
import com.openframe.api.dto.organization.UpdateOrganizationRequest;
import com.openframe.api.mapper.OrganizationMapper;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.service.OrganizationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Facade service for organization command operations (Create, Update, Delete).
 * Handles DTO to entity mapping and delegates to OrganizationService.
 * 
 * This service sits in api-lib to handle DTOs, avoiding circular dependencies.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OrganizationCommandService {

    private final OrganizationService organizationService;
    private final OrganizationMapper organizationMapper;

    /**
     * Create a new organization from DTO.
     * 
     * @param request create organization request
     * @return created organization
     */
    public Organization createOrganization(CreateOrganizationRequest request) {
        log.debug("Creating organization from request: {}", request.name());
        
        Organization organization = organizationMapper.toEntity(request);
        return organizationService.createOrganization(organization);
    }

    /**
     * Update an existing organization from DTO.
     * Performs partial update - only non-null fields are updated.
     * 
     * @param id organization database ID
     * @param request update organization request
     * @return updated organization
     */
    public Organization updateOrganization(String id, UpdateOrganizationRequest request) {
        log.debug("Updating organization {} from request", id);
        
        // Get existing organization
        Organization existing = organizationService.getOrganizationById(id)
                .orElseThrow(() -> new IllegalArgumentException("Organization not found with id: " + id));
        
        // Update with request data (only non-null fields)
        Organization toUpdate = organizationMapper.updateEntity(existing, request);
        return organizationService.updateOrganization(toUpdate);
    }

    /**
     * Delete an organization.
     * Delegates to OrganizationService which performs machine association check.
     * 
     * @param id organization database ID
     */
    public void deleteOrganization(String id) {
        log.debug("Deleting organization {}", id);
        organizationService.deleteOrganization(id);
    }
}
