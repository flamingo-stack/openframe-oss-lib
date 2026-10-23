package com.openframe.processing.version;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldNameConstants;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

// The newest event version a projection applied or handed to a task, per tenant and aggregate; every tenant's, so not TenantScoped.
@Data
@NoArgsConstructor
@AllArgsConstructor
@FieldNameConstants
@Document(collection = "projection_versions")
public class ProjectionVersion {

    private static final String ID_SEPARATOR = ":";

    @Id
    private String id;

    private String projection;
    private String tenantId;
    private String aggregateId;
    private long version;
    private Instant updatedAt;

    public static String idOf(String projection, String tenantId, String aggregateId) {
        return projection + ID_SEPARATOR + tenantId + ID_SEPARATOR + aggregateId;
    }
}
