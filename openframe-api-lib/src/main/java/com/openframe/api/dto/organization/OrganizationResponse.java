package com.openframe.api.dto.organization;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Shared DTO for organization response.
 * Used by both GraphQL (api-service-core) and REST (external-api).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrganizationResponse {
    private String id;
    private String name;
    private String organizationId;
    private String category;
    private Integer numberOfEmployees;
    private String websiteUrl;
    private String notes;
    private ContactInformationDto contactInformation;
    private BigDecimal monthlyRevenue;
    private LocalDate contractStartDate;
    private LocalDate contractEndDate;
    private Instant createdAt;
    private Instant updatedAt;
    private Boolean isDefault;
    private Boolean deleted;
    private Instant deletedAt;
}
