package com.openframe.test.data.dto.command;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// Payload for runCommand: a raw shell string sent to one machine (raw machineId, not a global id).
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RunCommandInput {
    private String machineId;
    private String shell;
    private String command;
    private String privilegeLevel;
    private Integer timeoutSeconds;
}
