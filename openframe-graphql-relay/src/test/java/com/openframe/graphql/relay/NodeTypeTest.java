package com.openframe.graphql.relay;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class NodeTypeTest {

    private static final String UNKNOWN_TYPE_NAME = "Foo";

    @Test
    void findByTypeName_graphqlTypeName_itsNodeType() {
        // execution
        Optional<NodeType> type = NodeType.findByTypeName("GuardrailPolicy");

        // verifications
        assertThat(type).contains(NodeType.GUARDRAIL_POLICY);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", UNKNOWN_TYPE_NAME, "GUARDRAIL_POLICY"})
    void findByTypeName_notAGraphqlTypeName_empty(String typeName) {
        // execution
        Optional<NodeType> type = NodeType.findByTypeName(typeName);

        // verifications
        assertThat(type).isEmpty();
    }

    @Test
    void fromTypeName_unknownTypeName_throwsIllegalArgument() {
        // execution
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> NodeType.fromTypeName(UNKNOWN_TYPE_NAME));

        // verifications
        assertThat(exception.getMessage()).isEqualTo("Unknown Node type: Foo");
    }
}
