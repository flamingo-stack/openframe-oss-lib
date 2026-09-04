package com.openframe.data.nats.rmm.model;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

/**
 * Wire payload for a result of a <b>saved script</b> execution.
 * Subject: {@code machine.{machineId}.script-execution.result}.
 *
 * <p>Extends {@link RmmResultMessage} with the two script-specific ids the agent
 * echoes back from the dispatch payload. The distinct Java type is also what lets
 * the result service route this to {@code MessageType.SCRIPT_EXECUTED} downstream
 * without an in-payload discriminator field.
 *
 * <p>Snake_case mapping ({@code script_id} → {@code scriptId}) comes from the
 * {@code @JsonNaming} on the superclass.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
public final class ScriptResultMessage extends RmmResultMessage {

    private String scriptId;
    private String scheduleId;
}
