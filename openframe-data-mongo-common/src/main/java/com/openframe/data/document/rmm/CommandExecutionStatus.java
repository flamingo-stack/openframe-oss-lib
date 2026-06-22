package com.openframe.data.document.rmm;

/**
 * Lifecycle status of a {@link CommandExecutionRequest} — a single ad-hoc
 * command dispatched to one or more agents under a shared {@code executionId}.
 *
 * <p>{@code PENDING} is the state the row is created in, right before the
 * command is published to the target agents over NATS. The transition to
 * {@code EXECUTED} happens once the agents' asynchronous results have come back
 * (that correlation step is handled separately).
 */
public enum CommandExecutionStatus {
    PENDING,
    EXECUTED
}
