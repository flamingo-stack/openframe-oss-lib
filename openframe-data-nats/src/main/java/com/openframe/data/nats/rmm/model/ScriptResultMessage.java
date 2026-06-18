package com.openframe.data.nats.rmm.model;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

/**
 * Wire payload for a result of a <b>saved script</b> execution.
 * Subject: {@code machine.{machineId}.script-execution.result}.
 *
 * <p>Same shape as {@link RmmResultMessage}; the distinct Java type is what
 * lets the result service route this to {@code MessageType.SCRIPT_EXECUTED}
 * downstream without an in-payload discriminator field.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
public class ScriptResultMessage extends RmmResultMessage {
}
