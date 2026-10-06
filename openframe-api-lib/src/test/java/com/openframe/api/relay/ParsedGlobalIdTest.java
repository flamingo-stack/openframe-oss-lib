package com.openframe.api.relay;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ParsedGlobalIdTest {

    private final ParsedGlobalId parsed = new ParsedGlobalId("Machine", "machine-1");

    @Test
    void isOfType_sameGraphqlTypeName_true() {
        // execution
        boolean machine = parsed.isOfType(NodeType.MACHINE);

        // verifications
        assertThat(machine).isTrue();
    }

    @Test
    void isOfType_otherGraphqlTypeName_false() {
        // execution
        boolean ticket = parsed.isOfType(NodeType.TICKET);

        // verifications
        assertThat(ticket).isFalse();
    }
}
