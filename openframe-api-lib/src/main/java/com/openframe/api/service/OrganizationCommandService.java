package com.openframe.api.service;

import com.openframe.api.dto.organization.CreateOrganizationRequest;
import com.openframe.api.dto.organization.UpdateOrganizationRequest;
import com.openframe.api.dto.organization.UpdateOrganizationStatusRequest;
import com.openframe.api.mapper.OrganizationMapper;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.organization.OrganizationStatus;
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

    public Organization createOrganization(CreateOrganizationRequest request) {
        log.debug("Creating organization from request: {}", request.name());
        
        Organization organization = organizationMapper.toEntity(request);
        return organizationService.createOrganization(organization);
    }

    // Partial update: only non-null fields from request are applied
    public Organization updateOrganization(String id, UpdateOrganizationRequest request) {
        log.debug("Updating organization {} from request", id);
        
        Organization existing = organizationService.getOrganizationByOrganizationId(id)
                .orElseThrow(() -> new IllegalArgumentException("Organization not found with id: " + id));
        
        // Update with request data (only non-null fields)
        Organization toUpdate = organizationMapper.updateEntity(existing, request);
        return organizationService.updateOrganization(toUpdate);
    }

    public void updateOrganizationStatus(String id, UpdateOrganizationStatusRequest request) {
        var newStatus = OrganizationStatus.valueOf(request.status().name());
        log.debug("Updating organization {} status to {}", id, newStatus);
        organizationService.updateOrganizationStatus(id, newStatus);
    }
}

