package com.openframe.test.data.dto.external.customer;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.openframe.test.data.dto.organization.ContactInformationDto;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Create customer request
 *
 * <p>Generated from the OpenFrame External API OpenAPI contract ({@code GET /api-docs}), version 1.1.0.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CreateCustomerRequest {

    /** Required by the contract. */
    private String name;

    private String category;

    private Integer numberOfEmployees;

    private String websiteUrl;

    private String notes;

    private ContactInformationDto contactInformation;

    private BigDecimal monthlyRevenue;

    private LocalDate contractStartDate;

    private LocalDate contractEndDate;
}
