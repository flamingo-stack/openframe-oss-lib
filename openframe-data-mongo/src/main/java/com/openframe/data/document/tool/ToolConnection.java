package com.openframe.data.document.tool;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Document(collection = "tool_connections")
@CompoundIndexes({
        @CompoundIndex(name = "machine_tool_idx", def = "{'machineId': 1, 'toolType': 1}", unique = true)
})
public class ToolConnection {
    @Id
    private String id;

    private String machineId;
    private ToolType toolType;
    private String agentToolId;

    private ConnectionStatus status;
    private String metadata;   // JSON string for tool-specific data

    private Instant connectedAt;
    private Instant lastSyncAt;
    private Instant disconnectedAt;

}