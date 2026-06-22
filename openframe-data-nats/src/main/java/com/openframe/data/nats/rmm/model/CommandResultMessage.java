package com.openframe.data.nats.rmm.model;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

/**
 * Wire payload for a result of an <b>ad-hoc command</b> execution.
 * Subject: {@code machine.{machineId}.command-execution.result}.
 *
 * <p>Same shape as {@link RmmResultMessage}; the distinct Java type is what
 * lets the result service route this to {@code MessageType.COMMAND_EXECUTED}
 * downstream without an in-payload discriminator field.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
public final class CommandResultMessage extends RmmResultMessage {
}
