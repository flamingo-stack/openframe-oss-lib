package com.openframe.test.data.dto.device;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ToolConnection {
    private String id;
    private String machineId;
    private String toolType;
    private String agentToolId;
    private ConnectionStatus status;
    private String metadata;
    private String connectedAt;
    private String lastSyncAt;
    /**
     * Populated only if the device query selects it, and it deliberately does not — see DeviceQueries.
     * <p>
     * The field exists on ToolConnection from oss-lib 6c10ae67c (#1959) onward. Selecting it against a
     * tenant API built before that commit is a query validation error (FieldUndefined), which rejects the
     * whole request rather than just this field -- being nullable does not help, because GraphQL validates
     * the selection set against the schema before it executes. That is what emptied the prod tenant report
     * on 2026-09-02, when the test service ran ahead of a tenant API still on 6.28.9.
     * <p>
     * Kept here rather than deleted so re-selecting it is a one-line change once every tenant API is
     * promoted past that commit. Nothing reads it today.
     */
    private String vulnerabilitiesUpdatedAt;
    private String disconnectedAt;
}
