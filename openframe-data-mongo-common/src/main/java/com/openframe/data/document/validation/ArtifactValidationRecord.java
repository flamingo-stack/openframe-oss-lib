package com.openframe.data.document.validation;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

/**
 * Validation gate outcome for artifacts stored in an external system that has
 * no metadata fields of its own (Fleet MDM policies and scheduled queries).
 * Keyed by (tenantId, artifactType, externalId); overwritten on every
 * re-validation (update path).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "artifact_validations")
@CompoundIndex(def = "{'tenantId': 1, 'artifactType': 1, 'externalId': 1}", unique = true)
public class ArtifactValidationRecord implements TenantScoped {
    @Id
    private String id;
    private String tenantId;
    /** FLEET_POLICY | FLEET_SCHEDULED_QUERY */
    private String artifactType;
    /** Fleet-side numeric id, stringified. */
    private String externalId;
    private Instant validatedAt;
    private List<String> methods;
    private List<String> targetOs;
    private boolean highImpact;
    private List<String> warnings;
}
