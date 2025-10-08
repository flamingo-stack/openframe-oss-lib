package com.openframe.api.dto.organization;

import jakarta.validation.Valid;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Builder;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Shared DTO for updating an existing organization.
 * Used by both GraphQL (api-service-core) and REST (external-api).
 * All fields are optional - only provided fields will be updated.
 */
@Builder
public record UpdateOrganizationRequest(
        String name,

        String category,

        @PositiveOrZero(message = "Number of employees must be zero or positive")
        Integer numberOfEmployees,

        String websiteUrl,

        String notes,

        @Valid
        ContactInformationDto contactInformation,

        @PositiveOrZero(message = "Monthly revenue must be zero or positive")
        BigDecimal monthlyRevenue,

        LocalDate contractStartDate,

        LocalDate contractEndDate
) {
}
