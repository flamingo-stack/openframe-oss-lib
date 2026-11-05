package com.openframe.api.service.organization;

import com.openframe.api.dto.organization.CreateOrganizationRequest;
import com.openframe.api.dto.organization.UpdateOrganizationRequest;
import com.openframe.api.dto.organization.UpdateOrganizationStatusRequest;
import com.openframe.api.mapper.OrganizationMapper;
import com.openframe.api.validation.ContractPeriodValidator;
import com.openframe.api.validation.ValidContractPeriod;
import com.openframe.audit.Audited;
import com.openframe.core.exception.ValidationException;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.organization.OrganizationStatus;
import com.openframe.data.service.OrganizationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

import static com.openframe.data.document.audit.AuditAction.ORGANIZATION_CREATE;
import static com.openframe.data.document.audit.AuditAction.ORGANIZATION_STATUS_CHANGE;
import static com.openframe.data.document.audit.AuditAction.ORGANIZATION_UPDATE;

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
    @Audited(action = ORGANIZATION_CREATE, targetId = "#result.organizationId")
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
    @Audited(action = ORGANIZATION_UPDATE, targetId = "#id")
    public Organization updateOrganization(String id, UpdateOrganizationRequest request) {
        log.debug("Updating organization {} from request", id);
        
        Organization existing = organizationService.getOrganizationByOrganizationId(id)
                .orElseThrow(() -> new IllegalArgumentException("Organization not found with id: " + id));
        
        // Update with request data (only non-null fields)
        Organization toUpdate = organizationMapper.updateEntity(existing, request);
        // A partial update can pair a new end date with a stored start date, which the request alone cannot see.
        requireContractEndNotBeforeStart(toUpdate);
        return organizationService.updateOrganization(toUpdate);
    }

    private void requireContractEndNotBeforeStart(Organization organization) {
        boolean endsBeforeStart = ContractPeriodValidator.endsBeforeStart(
                organization.getContractStartDate(), organization.getContractEndDate());
        if (endsBeforeStart) {
            ValidationException.FieldError fieldError =
                    new ValidationException.FieldError(ValidContractPeriod.FIELD, ValidContractPeriod.MESSAGE);
            throw new ValidationException(ValidContractPeriod.MESSAGE, List.of(fieldError));
        }
    }

    /**
     * Update organization status.
     * Maps the DTO action to the domain status and delegates to OrganizationService.
     *
     * @param id organization database ID
     * @param request status update request
     */
    @Audited(action = ORGANIZATION_STATUS_CHANGE, targetId = "#id", details = "status=#request.status")
    public void updateOrganizationStatus(String id, UpdateOrganizationStatusRequest request) {
        var newStatus = OrganizationStatus.valueOf(request.status().name());
        log.debug("Updating organization {} status to {}", id, newStatus);
        organizationService.updateOrganizationStatus(id, newStatus);
    }
}
