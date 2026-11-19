package com.openframe.api.schema;

import graphql.language.StringValue;
import graphql.schema.Coercing;
import graphql.schema.GraphQLEnumType;
import graphql.schema.GraphQLEnumValueDefinition;
import graphql.schema.GraphQLFieldDefinition;
import graphql.schema.GraphQLInputObjectType;
import graphql.schema.GraphQLList;
import graphql.schema.GraphQLNonNull;
import graphql.schema.GraphQLScalarType;
import graphql.schema.GraphQLSchema;
import graphql.schema.GraphQLType;
import graphql.schema.GraphQLTypeUtil;
import graphql.schema.idl.RuntimeWiring;
import graphql.schema.idl.SchemaGenerator;
import graphql.schema.idl.SchemaParser;
import graphql.schema.idl.TypeDefinitionRegistry;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class MdmSchemaTest {

    private static final String SHARED_TYPES = """
            type Query { _placeholder: Boolean }
            type Mutation { _placeholder: Boolean }
            scalar Instant
            type PageInfo {
                hasNextPage: Boolean!
                hasPreviousPage: Boolean!
                startCursor: String
                endCursor: String
            }
            enum OsType {
                WINDOWS
                MAC_OS
            }
            type Organization { organizationId: String! }
            type Machine {
                machineId: String!
                osType: OsType!
            }
            type MutationError {
                field: [String!]
                message: String!
            }
            type MutationDeletePayload {
                deletedId: ID
                userErrors: [MutationError!]!
            }
            input MutationDeleteInput { id: ID! }
            """;

    private static GraphQLSchema schema;

    @BeforeAll
    static void buildSchema() throws Exception {
        TypeDefinitionRegistry registry = new SchemaParser().parse(SHARED_TYPES);
        registry.merge(new SchemaParser().parse(read("schema/mdm.graphqls")));

        RuntimeWiring wiring = RuntimeWiring.newRuntimeWiring()
                .scalar(passThroughScalar("Instant"))
                .build();
        schema = new SchemaGenerator().makeExecutableSchema(registry, wiring);
    }

    @ParameterizedTest
    @ValueSource(strings = {"WINDOWS", "MAC_OS", "IOS", "IPADOS", "ANDROID"})
    void osType_coversComputersAndPhones(String value) {
        // setup
        GraphQLEnumType osType = schema.getTypeAs("OsType");

        // execution
        GraphQLEnumValueDefinition definition = osType.getValue(value);

        // verifications
        assertThat(definition).isNotNull();
    }

    @Test
    void machineMdm_nullForDevicesMdmNeverManaged() {
        // setup
        GraphQLFieldDefinition mdm = schema.getObjectType("Machine").getFieldDefinition("mdm");

        // execution
        GraphQLType type = mdm.getType();

        // verifications
        assertThat(type).isNotInstanceOf(GraphQLNonNull.class);
        assertThat(GraphQLTypeUtil.simplePrint(type)).isEqualTo("DeviceMdm");
    }

    @Test
    void availableCommands_nonNullListOfPredefinedCommands() {
        // setup
        GraphQLFieldDefinition field = schema.getObjectType("DeviceMdm").getFieldDefinition("availableCommands");

        // execution
        String type = GraphQLTypeUtil.simplePrint(field.getType());

        // verifications
        assertThat(type).isEqualTo("[MdmPredefinedCommand!]!");
    }

    @Test
    void runMdmCommandInput_lockTextOptional() {
        // setup
        GraphQLInputObjectType input = schema.getTypeAs("RunMdmCommandInput");

        // execution
        GraphQLType machineId = input.getField("machineId").getType();
        GraphQLType command = input.getField("command").getType();
        GraphQLType message = input.getField("message").getType();
        GraphQLType phoneNumber = input.getField("phoneNumber").getType();

        // verifications
        assertThat(machineId).isInstanceOf(GraphQLNonNull.class);
        assertThat(command).isInstanceOf(GraphQLNonNull.class);
        assertThat(message).isNotInstanceOf(GraphQLNonNull.class);
        assertThat(phoneNumber).isNotInstanceOf(GraphQLNonNull.class);
    }

    @Test
    void mdmCommands_pagedPerDevice() {
        // setup
        GraphQLFieldDefinition query = schema.getQueryType().getFieldDefinition("mdmCommands");

        // execution
        String type = GraphQLTypeUtil.simplePrint(query.getType());

        // verifications
        assertThat(type).isEqualTo("MdmCommandConnection!");
        assertThat(query.getArgument("machineId").getType()).isInstanceOf(GraphQLNonNull.class);
        assertThat(schema.getObjectType("MdmCommandConnection").getFieldDefinition("pageInfo")).isNotNull();
    }

    @Test
    void revokeMdmEnrollmentLink_returnsTheLinkWithItsRevocationTime() {
        // setup
        GraphQLFieldDefinition mutation = schema.getMutationType().getFieldDefinition("revokeMdmEnrollmentLink");

        // execution
        String type = GraphQLTypeUtil.simplePrint(mutation.getType());
        GraphQLType revokedAt = schema.getObjectType("MdmEnrollmentLink").getFieldDefinition("revokedAt").getType();

        // verifications
        assertThat(type).isEqualTo("MdmEnrollmentLink!");
        assertThat(GraphQLTypeUtil.simplePrint(mutation.getArgument("id").getType())).isEqualTo("ID!");
        assertThat(GraphQLTypeUtil.simplePrint(revokedAt)).isEqualTo("Instant");
    }

    @Test
    void mdmPlatforms_nonNullList() {
        // setup
        GraphQLFieldDefinition query = schema.getQueryType().getFieldDefinition("mdmPlatforms");

        // execution
        GraphQLType type = GraphQLTypeUtil.unwrapNonNull(query.getType());

        // verifications
        assertThat(query.getType()).isInstanceOf(GraphQLNonNull.class);
        assertThat(type).isInstanceOf(GraphQLList.class);
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
        try (InputStream in = MdmSchemaTest.class.getClassLoader().getResourceAsStream(resource)) {
            assertThat(in).as(resource).isNotNull();
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
