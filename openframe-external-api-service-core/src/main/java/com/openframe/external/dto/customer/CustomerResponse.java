package com.openframe.external.dto.customer;

import com.openframe.api.dto.organization.ContactInformationDto;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Customer")
public class CustomerResponse {

    @Schema(description = "Customer identifier. This is the id every customer endpoint takes and the value referenced as customerId elsewhere in the API.",
            example = "0b0f9f3a-9c1d-4a5e-9d55-8c9a2f6f1e42")
    private String id;

    @Schema(description = "Customer name", example = "Acme Corporation")
    private String name;

    @Schema(description = "Category", example = "MSP client")
    private String category;

    @Schema(description = "Number of employees")
    private Integer numberOfEmployees;

    @Schema(description = "Website URL")
    private String websiteUrl;

    @Schema(description = "Free-form notes")
    private String notes;

    @Schema(description = "Contacts and addresses")
    private ContactInformationDto contactInformation;

    @Schema(description = "Monthly revenue")
    private BigDecimal monthlyRevenue;

    @Schema(description = "Contract start date")
    private LocalDate contractStartDate;

    @Schema(description = "Contract end date")
    private LocalDate contractEndDate;

    @Schema(description = "Creation timestamp")
    private Instant createdAt;

    @Schema(description = "Last update timestamp")
    private Instant updatedAt;

    @Schema(description = "Canonical last-activity timestamp: updatedAt, falling back to createdAt (display value; the lastActivityFrom/To filter matches updatedAt only)")
    private Instant lastActivityAt;

    @Schema(description = "True for the tenant's default customer")
    private Boolean isDefault;

    @Schema(description = "Status (ACTIVE or ARCHIVED)")
    private String status;

    @Schema(description = "When the status last changed")
    private Instant statusChangedAt;
}
