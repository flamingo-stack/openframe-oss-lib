package com.openframe.api.dto.organization;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Shared DTO for creating a new organization.
 * Used by both GraphQL (api-service-core) and REST (external-api).
 * 
 * Note: organizationId is generated automatically on the backend as UUID.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateOrganizationRequest {
        @NotBlank(message = "Name is required")
        private String name;

        private String category;

        @PositiveOrZero(message = "Number of employees must be zero or positive")
        private Integer numberOfEmployees;

        private String websiteUrl;

        private String notes;

        @Valid
        private ContactInformationDto contactInformation;

        @PositiveOrZero(message = "Monthly revenue must be zero or positive")
        private BigDecimal monthlyRevenue;

        private LocalDate contractStartDate;

        private LocalDate contractEndDate;
}
