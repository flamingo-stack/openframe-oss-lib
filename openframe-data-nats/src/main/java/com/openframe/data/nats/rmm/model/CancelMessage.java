package com.openframe.data.nats.rmm.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Wire payload sent to the OpenFrame agent over NATS to abort an in-flight
 * execution.
 *
 * <p>Subject: {@code machine.{machineId}.script-cancel} (parallel to
 * {@code script-execution}).
 *
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CancelMessage {

    /** Correlation id of the execution to cancel. */
    private String executionId;
}
