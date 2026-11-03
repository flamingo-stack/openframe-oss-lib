package com.openframe.api.dto.organization;

import com.openframe.api.validation.ContractPeriod;
import com.openframe.api.validation.ValidContractPeriod;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
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
@ValidContractPeriod
public record UpdateOrganizationRequest(
        // null leaves the name unchanged; a value must contain at least one non-whitespace character
        @Pattern(regexp = NOT_BLANK, message = "Name must not be blank")
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
) implements ContractPeriod {

    public static final String NOT_BLANK = "(?s).*\\S.*";
}
