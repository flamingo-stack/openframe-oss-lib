package com.openframe.data.document.tool;

import com.openframe.data.document.TenantScoped;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Document(collection = "tool_connections")
@CompoundIndexes({
        @CompoundIndex(name = "tenant_machine_tool_idx", def = "{'tenantId': 1, 'machineId': 1, 'toolType': 1}", unique = true)
})
public class ToolConnection implements TenantScoped {
    @Id
    private String id;

    @Indexed
    private String tenantId;

    private String machineId;
    private ToolType toolType;
    private String agentToolId;

    private ConnectionStatus status;
    private String metadata;   // JSON string for tool-specific data

    private Instant connectedAt;
    private Instant lastSyncAt;
    private Instant disconnectedAt;

}