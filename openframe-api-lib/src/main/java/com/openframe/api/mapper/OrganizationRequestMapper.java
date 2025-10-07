package com.openframe.api.mapper;

import com.openframe.api.dto.organization.CreateOrganizationRequest;
import com.openframe.api.dto.organization.UpdateOrganizationRequest;
import com.openframe.data.document.organization.Organization;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Shared mapper for converting organization request DTOs to entities.
 * Used by both GraphQL and REST APIs.
 */
@Component
public class OrganizationRequestMapper {

    /**
     * Convert CreateOrganizationRequest to Organization entity.
     * Generates organizationId automatically as UUID.
     */
    public Organization toEntity(CreateOrganizationRequest request) {
        if (request == null) {
            return null;
        }

        return Organization.builder()
                .name(request.name())
                .organizationId(generateOrganizationId())
                .category(request.category())
                .numberOfEmployees(request.numberOfEmployees())
                .websiteUrl(request.websiteUrl())
                .monthlyRevenue(request.monthlyRevenue())
                .contractStartDate(request.contractStartDate())
                .contractEndDate(request.contractEndDate())
                .deleted(false)
                .build();
    }

    /**
     * Generate unique organizationId as UUID.
     */
    private String generateOrganizationId() {
        return UUID.randomUUID().toString();
    }

    /**
     * Update Organization entity from UpdateOrganizationRequest.
     * Only updates non-null fields from the request (partial update).
     * 
     * Note: organizationId cannot be updated - it's immutable once created.
     */
    public Organization updateEntity(Organization existing, UpdateOrganizationRequest request) {
        if (request == null) {
            return existing;
        }

        // Update only allowed fields (organizationId is immutable)
        if (request.name() != null) {
            existing.setName(request.name());
        }
        if (request.category() != null) {
            existing.setCategory(request.category());
        }
        if (request.numberOfEmployees() != null) {
            existing.setNumberOfEmployees(request.numberOfEmployees());
        }
        if (request.websiteUrl() != null) {
            existing.setWebsiteUrl(request.websiteUrl());
        }
        if (request.monthlyRevenue() != null) {
            existing.setMonthlyRevenue(request.monthlyRevenue());
        }
        if (request.contractStartDate() != null) {
            existing.setContractStartDate(request.contractStartDate());
        }
        if (request.contractEndDate() != null) {
            existing.setContractEndDate(request.contractEndDate());
        }

        return existing;
    }
}
