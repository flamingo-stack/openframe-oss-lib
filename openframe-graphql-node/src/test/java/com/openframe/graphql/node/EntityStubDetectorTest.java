package com.openframe.graphql.node;

import com.openframe.graphql.relay.NodeType;
import graphql.schema.GraphQLSchema;
import graphql.schema.idl.RuntimeWiring;
import graphql.schema.idl.SchemaGenerator;
import graphql.schema.idl.SchemaParser;
import graphql.schema.idl.TypeDefinitionRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Named;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

class EntityStubDetectorTest {

    private static final String SCHEMA_SDL = """
            directive @key(fields: String!, resolvable: Boolean = true) repeatable on OBJECT | INTERFACE

            type Query {
                placeholder: Boolean
            }

            interface Node {
                id: ID!
            }

            type Dialog implements Node @key(fields: "id", resolvable: false) {
                id: ID!
            }

            type User implements Node @key(fields: "id", resolvable: false) {
                id: ID!
                firstName: String
            }

            type Ticket implements Node @key(fields: "id") {
                id: ID!
            }

            type Message implements Node {
                id: ID!
            }

            type TicketNote @key(fields: "id", resolvable: false) {
                id: ID!
            }

            type TicketAttachment implements Node @key(fields: "id", resolvable: false) @key(fields: "id") {
                id: ID!
            }
            """;

    private final EntityStubDetector detector = new EntityStubDetector();

    private GraphQLSchema schema;

    @BeforeEach
    void setUp() {
        TypeDefinitionRegistry typeRegistry = new SchemaParser().parse(SCHEMA_SDL);
        schema = new SchemaGenerator().makeExecutableSchema(typeRegistry, RuntimeWiring.MOCKED_WIRING);
    }

    @Test
    void isReferenceStub_nodeWithOnlyItsUnresolvableKeyField_true() {
        // execution
        boolean stub = detector.isReferenceStub(schema, NodeType.DIALOG);

        // verifications
        assertThat(stub).isTrue();
    }

    @ParameterizedTest
    @MethodSource("typesThatAreNotStubs")
    void isReferenceStub_notAReferenceStub_false(NodeType type) {
        // execution
        boolean stub = detector.isReferenceStub(schema, type);

        // verifications
        assertThat(stub).isFalse();
    }

    private static Stream<Arguments> typesThatAreNotStubs() {
        return Stream.of(
                Arguments.of(Named.of("declares a field outside its key", NodeType.USER)),
                Arguments.of(Named.of("resolvable key", NodeType.TICKET)),
                Arguments.of(Named.of("no key", NodeType.MESSAGE)),
                Arguments.of(Named.of("not a Node", NodeType.TICKET_NOTE)),
                Arguments.of(Named.of("one resolvable key among its keys", NodeType.TICKET_ATTACHMENT)),
                Arguments.of(Named.of("absent from the schema", NodeType.MACHINE)));
    }
}
