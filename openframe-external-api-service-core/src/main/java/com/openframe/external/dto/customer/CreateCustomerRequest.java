package com.openframe.external.dto.customer;

import com.openframe.api.dto.organization.ContactInformationDto;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.LocalDate;

@Schema(description = "Create customer request")
public record CreateCustomerRequest(
        @NotBlank(message = "Name is required")
        @Schema(description = "Customer name", requiredMode = Schema.RequiredMode.REQUIRED)
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
