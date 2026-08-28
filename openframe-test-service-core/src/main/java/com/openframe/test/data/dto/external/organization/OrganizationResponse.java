package com.openframe.test.data.dto.external.organization;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.openframe.test.data.dto.organization.ContactInformationDto;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Response payload from the External API.
 *
 * <p>Generated from the OpenFrame External API OpenAPI contract ({@code GET /api-docs}), version 1.1.0.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
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

    private Instant lastActivityAt;

    private Boolean isDefault;

    private String status;

    private Instant statusChangedAt;
}
