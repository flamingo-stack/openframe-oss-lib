package com.openframe.test.data.dto.command;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// Payload for batchRunCommand: one raw shell string fanned out to several machines under one executionId.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class BatchRunCommandInput {
    private List<String> machineIds;
    private String shell;
    private String command;
    private String privilegeLevel;
    private Integer timeoutSeconds;
}
