package com.openframe.test.data.dto.ai;

/**
 * Dialog agent type. ADMIN is the technician-facing dialog whose execution target resolves from the
 * linked ticket's device (see {@code MachineIdResolverService}).
 */
public enum AgentType {
    CLIENT,
    ADMIN
}
