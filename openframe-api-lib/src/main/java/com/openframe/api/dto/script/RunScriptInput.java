package com.openframe.api.dto.script;

import com.openframe.data.document.rmm.PrivilegeLevel;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.util.List;

/**
 * GraphQL input for dispatching a <b>saved</b> script to an agent.
 */
@Data
public class RunScriptInput {

    @NotBlank
    private String machineId;

    @NotBlank
    private String scriptId;

    @NotNull
    private PrivilegeLevel privilegeLevel;

    private List<String> args;

    @Positive
    private Integer timeoutSeconds;
}
