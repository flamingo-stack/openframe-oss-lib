package com.openframe.data.nats.rmm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

/**
 * Wire payload published by the OpenFrame agent over core NATS for the result
 * of an RMM execution. Sealed: exactly two concrete subtypes —
 * {@link CommandResultMessage} and {@link ScriptResultMessage} — share this
 * shape verbatim and only differ in their Java type so downstream code (the
 * result service, audit, etc.) can distinguish a command result from a
 * saved-script result without an in-payload discriminator. The sealed
 * declaration also makes any pattern-matching switch on this type
 * compile-time exhaustive — a new subtype can't be added without forcing
 * every consumer to consider it.
 *
 * <p>Mirrors the agent's execution-result struct. The agent serializes with
 * snake_case keys, so {@link JsonNaming} maps them onto these camelCase fields
 * ({@code execution_id} → {@code executionId}, etc.).
 */
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public abstract sealed class RmmResultMessage
        permits CommandResultMessage, ScriptResultMessage {

    private String executionId;

    private String machineId;

    private String stdout;

    private String stderr;

    private Integer exitCode;

    private Long executionTimeMs;

    private Boolean timedOut;

    private String error;
}
