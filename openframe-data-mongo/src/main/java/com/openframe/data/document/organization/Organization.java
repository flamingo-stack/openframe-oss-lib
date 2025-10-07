package com.openframe.data.document.organization;

import jakarta.validation.constraints.NotBlank;
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
     * Soft delete flag - when true, organization is considered deleted
     */
    @Indexed
    @Builder.Default
    private Boolean deleted = false;

    /**
     * Timestamp when organization was soft deleted
     */
    private Instant deletedAt;

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
        return Boolean.TRUE.equals(deleted);
    }
}

