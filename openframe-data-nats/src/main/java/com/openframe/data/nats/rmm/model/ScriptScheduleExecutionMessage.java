package com.openframe.data.nats.rmm.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.openframe.delivery.spec.DeliveryPayload;
import com.openframe.delivery.spec.DeliveryRef;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Wire payload sent to the OpenFrame agent over core NATS for a schedule fire —
 * <b>one message per target machine</b>, carrying the full set of scripts the
 * schedule runs. Replaces the per-script fan-out ({@link ScriptMessage}) for
 * schedule-triggered dispatches: for M machines and N scripts, the schedule
 * flow emits M messages instead of N×M.
 *
 * <pre>
 *   Subject: machine.{machineId}.script-schedule-execution
 * </pre>
 *
 * <p>{@code executionId} is shared across every message in the run and every
 * leaf {@code ScriptExecution} row it produces — the agent reports each
 * (scriptId, machineId) result back on the existing result channel and it
 * correlates via that shared id.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ScriptScheduleExecutionMessage implements DeliveryPayload {

    // stamped by the delivery engine; absent from the JSON on the path without the engine, and an agent that does not
    // know the block skips it
    private DeliveryRef delivery;

    private String executionId;

    private String scheduleId;

    // no longer set: the agent takes its own id and never read this one, and a batch without it is the same body for
    // every machine of the fire. Kept so a retry state stored before this change still reads
    private String machineId;

    private String initiatedBy;

    private List<ScriptScheduleExecutionItem> scripts;
}
