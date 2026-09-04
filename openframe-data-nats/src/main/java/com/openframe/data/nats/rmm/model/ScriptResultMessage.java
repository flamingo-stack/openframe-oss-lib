package com.openframe.data.nats.rmm.model;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

/**
 * Wire payload for a result of a <b>saved script</b> execution.
 * Subject: {@code machine.{machineId}.script-execution.result}.
 *
 */
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
public final class ScriptResultMessage extends RmmResultMessage {

    private String scriptId;
    private String scheduleId;
}
