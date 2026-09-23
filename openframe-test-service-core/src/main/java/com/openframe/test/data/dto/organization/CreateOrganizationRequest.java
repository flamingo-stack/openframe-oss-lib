package com.openframe.test.data.dto.organization;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * Shared DTO for creating a new organization.
 * Note: organizationId is generated automatically on the backend as UUID.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CreateOrganizationRequest {
    String name;
    String category;
    Integer numberOfEmployees;
    String websiteUrl;
    String notes;
    ContactInformationDto contactInformation;
    String monthlyRevenue;
    LocalDate contractStartDate;
    LocalDate contractEndDate;
}

