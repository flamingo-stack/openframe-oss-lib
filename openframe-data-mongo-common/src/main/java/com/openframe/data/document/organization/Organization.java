package com.openframe.data.document.organization;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Organization document representing a company or entity in the system.
 * Contains business-related information such as revenue, employees, and contract details.
 */
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "organizations")
public class Organization {

    @Id
    private String id;

    /**
     * Organization name (company name)
     */
    @Indexed
    private String name;

    /**
     * Unique organization identifier (generated as UUID on creation)
     * This field is immutable - cannot be changed after creation.
     */
    @NotBlank
    @Indexed(unique = true)
    private String organizationId;

    /**
     * Flag indicating if this is the default organization for the tenant
     */
    @NotNull
    @Indexed
    @Builder.Default
    private Boolean isDefault = false;

    /**
     * Business category or industry
     */
    private String category;

    /**
     * Total number of employees
     */
    private Integer numberOfEmployees;

    /**
     * Organization website URL
     */
    private String websiteUrl;

    /**
     * Notes or additional information about the organization
     */
    private String notes;

    /**
     * Contact information including contacts and addresses
     */
    private ContactInformation contactInformation;

    /**
     * Monthly revenue in the organization's currency
     */
    private BigDecimal monthlyRevenue;

    /**
     * Contract start date
     */
    private LocalDate contractStartDate;

    /**
     * Contract end date
     */
    private LocalDate contractEndDate;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    /**
     * Organization status. Defaults to ACTIVE.
     * ARCHIVED - organization is hidden from normal queries but remains in the database.
     * This is used instead of deletion because devices with DELETED status may come back
     * online and need their organization reference intact.
     * DELETED - organization is soft deleted.
     */
    @Indexed
    @Builder.Default
    private OrganizationStatus status = OrganizationStatus.ACTIVE;

    /**
     * Timestamp when organization status was last changed (archived or deleted)
     */
    private Instant statusChangedAt;

    /**
     * Check if the contract is currently active
     */
    public boolean isContractActive() {
        LocalDate now = LocalDate.now();
        return contractStartDate != null
            && contractEndDate != null
            && !now.isBefore(contractStartDate)
            && !now.isAfter(contractEndDate);
    }

    /**
     * Check if organization is deleted (soft delete)
     */
    public boolean isDeleted() {
        return status == OrganizationStatus.DELETED;
    }

    /**
     * Check if organization is archived
     */
    public boolean isArchived() {
        return status == OrganizationStatus.ARCHIVED;
    }
}

