package com.openframe.external.dto.customer;

import com.openframe.api.dto.organization.ContactInformationDto;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Create customer request")
public class CreateCustomerRequest {
        @NotBlank(message = "Name is required")
        @Schema(description = "Customer name", requiredMode = Schema.RequiredMode.REQUIRED)
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

