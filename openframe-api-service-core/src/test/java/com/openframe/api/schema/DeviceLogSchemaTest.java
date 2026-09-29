package com.openframe.api.schema;

import graphql.language.StringValue;
import graphql.schema.Coercing;
import graphql.schema.GraphQLArgument;
import graphql.schema.GraphQLFieldDefinition;
import graphql.schema.GraphQLList;
import graphql.schema.GraphQLNonNull;
import graphql.schema.GraphQLScalarType;
import graphql.schema.GraphQLSchema;
import graphql.schema.idl.RuntimeWiring;
import graphql.schema.idl.SchemaGenerator;
import graphql.schema.idl.SchemaParser;
import graphql.schema.idl.TypeDefinitionRegistry;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Builds an executable schema from {@code device-log.graphqls} alone, with stand-ins for the shared types it
 * references. The DGS context builds the whole schema only at startup, so without this a schema mistake - an
 * argument the spec forbids deprecating, a type that no longer resolves - would first show up as a failing pod.
 */
class DeviceLogSchemaTest {

    private static final String SHARED_TYPES = """
            type Query { _placeholder: Boolean }
            scalar Instant
            scalar Long
            type PageInfo {
                hasNextPage: Boolean!
                hasPreviousPage: Boolean!
                startCursor: String
                endCursor: String
            }
            """;

    private static GraphQLSchema schema;

    @BeforeAll
    static void buildSchema() throws Exception {
        TypeDefinitionRegistry registry = new SchemaParser().parse(SHARED_TYPES);
        registry.merge(new SchemaParser().parse(read("schema/device-log.graphqls")));

        RuntimeWiring wiring = RuntimeWiring.newRuntimeWiring()
                .scalar(passThroughScalar("Instant"))
                .scalar(passThroughScalar("Long"))
                .build();
        schema = new SchemaGenerator().makeExecutableSchema(registry, wiring);
    }

    @Test
    void keepsTheSingleDeviceArgumentUsableWhileMarkingItDeprecated() {
        GraphQLArgument machineId = deviceLogs().getArgument("machineId");

        assertThat(machineId.isDeprecated()).isTrue();
        // The spec forbids deprecating a required argument, so this must stay nullable - and a client that
        // still sends it keeps working
        assertThat(machineId.getType()).isNotInstanceOf(GraphQLNonNull.class);
    }

    @Test
    void acceptsAListOfDevicesAndNoneAtAll() {
        GraphQLArgument machineIds = deviceLogs().getArgument("machineIds");

        assertThat(machineIds.getType()).isInstanceOf(GraphQLList.class);
        assertThat(machineIds.getType()).isNotInstanceOf(GraphQLNonNull.class);
    }

    @Test
    void exposesTheDeviceOfEachLine() {
        assertThat(schema.getObjectType("DeviceLogEntry").getFieldDefinition("machineId")).isNotNull();
    }

    private static GraphQLFieldDefinition deviceLogs() {
        return schema.getQueryType().getFieldDefinition("deviceLogs");
    }

    private static GraphQLScalarType passThroughScalar(String name) {
        return GraphQLScalarType.newScalar().name(name).coercing(new Coercing<Object, Object>() {
            @Override
            public Object serialize(Object input) {
                return input;
            }

            @Override
            public Object parseValue(Object input) {
                return input;
            }

            @Override
            public Object parseLiteral(Object input) {
                return input instanceof StringValue value ? value.getValue() : input;
            }
        }).build();
    }

    private static String read(String resource) throws Exception {
        try (InputStream in = DeviceLogSchemaTest.class.getClassLoader().getResourceAsStream(resource)) {
            assertThat(in).as(resource).isNotNull();
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
