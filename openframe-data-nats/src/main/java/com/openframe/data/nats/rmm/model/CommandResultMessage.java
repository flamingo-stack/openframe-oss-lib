package com.openframe.data.nats.rmm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Wire payload published by the OpenFrame agent over core NATS on
 * {@code machine.{machineId}.command-execution.result}.
 *
 * <p>Mirrors the agent's {@code CommandExecutionResult} struct. The agent
 * serializes with snake_case keys, so {@link JsonNaming} maps them onto these
 * camelCase fields ({@code execution_id} → {@code executionId}, etc.).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CommandResultMessage {

    private String executionId;

    private String machineId;

    private String stdout;

    private String stderr;

    private Integer exitCode;

    private Long executionTimeMs;

    private Boolean timedOut;

    private String error;
}
