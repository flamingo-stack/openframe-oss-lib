package com.openframe.test.data.dto.tenant;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.bson.codecs.pojo.annotations.BsonId;

import java.time.LocalDateTime;

/**
 * Tenant DTO for multi-tenant architecture.
 * Each tenant represents an organization/company using OpenFrame.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Tenant {
    @BsonId
    private String id;
    private String name;
    private String domain;
    private String ownerId;
    private TenantStatus status;
    private TenantPlan plan;
    private String hubspotId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
