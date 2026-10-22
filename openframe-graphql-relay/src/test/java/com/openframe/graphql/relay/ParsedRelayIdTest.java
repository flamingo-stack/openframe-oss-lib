package com.openframe.graphql.relay;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ParsedRelayIdTest {

    private final ParsedRelayId parsed = new ParsedRelayId("Machine", "machine-1");

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
