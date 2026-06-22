package com.openframe.data.document.rmm;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "command_execution_requests")
@CompoundIndex(
        def = "{'machineId': 1, 'executionId': 1}",
        unique = true
)
public class CommandExecutionRequest {

    @Id
    private String id;

    private String executionId;

    private String machineId;

    private String command;

    private ScriptShell shell;

    private PrivilegeLevel privilegeLevel;

    private Integer timeoutSeconds;

    @Builder.Default
    private CommandExecutionStatus status = CommandExecutionStatus.PENDING;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
