package com.openframe.external.dto.customer;

import com.openframe.api.dto.organization.ContactInformationDto;
import com.openframe.api.dto.organization.UpdateOrganizationRequest;
import com.openframe.api.validation.ContractPeriod;
import com.openframe.api.validation.ValidContractPeriod;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.LocalDate;

@Schema(description = "Update customer request; only non-null fields are applied")
@ValidContractPeriod
public record UpdateCustomerRequest(
        @Pattern(regexp = UpdateOrganizationRequest.NOT_BLANK, message = "Name must not be blank")
        @Schema(description = "Customer name; omit to keep the current one, must not be blank when given")
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
}
