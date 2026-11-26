package com.openframe.api.schema;

import graphql.language.StringValue;
import graphql.schema.Coercing;
import graphql.schema.GraphQLEnumType;
import graphql.schema.GraphQLEnumValueDefinition;
import graphql.schema.GraphQLFieldDefinition;
import graphql.schema.GraphQLInputObjectType;
import graphql.schema.GraphQLList;
import graphql.schema.GraphQLNonNull;
import graphql.schema.GraphQLObjectType;
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
            type DeviceFilterOption {
                value: String!
                label: String!
                count: Int!
            }
            type DeviceFilters { filteredCount: Int! }
            input DeviceFilterInput { osTypes: [String!] }
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

    @ParameterizedTest
    @ValueSource(strings = {"APPLE", "ANDROID", "WINDOWS"})
    void mdmPlatform_coversWindows(String value) {
        // setup
        GraphQLEnumType platform = schema.getTypeAs("MdmPlatform");

        // execution
        GraphQLEnumValueDefinition definition = platform.getValue(value);

        // verifications
        assertThat(definition).isNotNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"MANAGED", "UNENROLLED", "PENDING", "LEAVING", "REMOVED", "NOT_IN_SCOPE", "NOT_SUPPORTED",
            "OTHER_MDM", "WIPED"})
    void mdmEnrollmentState_coversWindowsStates(String value) {
        // setup
        GraphQLEnumType state = schema.getTypeAs("MdmEnrollmentState");

        // execution
        GraphQLEnumValueDefinition definition = state.getValue(value);

        // verifications
        assertThat(definition).isNotNull();
    }

    @Test
    void deviceMdm_windowsPartsNullableActionsNonNull() {
        // setup
        GraphQLObjectType deviceMdm = schema.getObjectType("DeviceMdm");

        // execution
        String actions = GraphQLTypeUtil.simplePrint(deviceMdm.getFieldDefinition("availableActions").getType());
        GraphQLType diskEncryption = deviceMdm.getFieldDefinition("diskEncryption").getType();
        GraphQLType lock = deviceMdm.getFieldDefinition("lock").getType();
        GraphQLType wipe = deviceMdm.getFieldDefinition("wipe").getType();

        // verifications
        assertThat(actions).isEqualTo("[MdmDeviceAction!]!");
        assertThat(diskEncryption).isNotInstanceOf(GraphQLNonNull.class);
        assertThat(lock).isNotInstanceOf(GraphQLNonNull.class);
        assertThat(wipe).isNotInstanceOf(GraphQLNonNull.class);
    }

    @Test
    void diskEncryption_neverCarriesTheRecoveryKey() {
        // setup
        GraphQLObjectType diskEncryption = schema.getObjectType("DiskEncryption");

        // execution
        GraphQLFieldDefinition key = diskEncryption.getFieldDefinition("key");
        GraphQLFieldDefinition stored = diskEncryption.getFieldDefinition("recoveryKeyStored");

        // verifications
        assertThat(key).isNull();
        assertThat(GraphQLTypeUtil.simplePrint(stored.getType())).isEqualTo("Boolean!");
    }

    @Test
    void revealRecoveryKey_isAMutationPerDevice() {
        // setup
        GraphQLFieldDefinition mutation = schema.getMutationType().getFieldDefinition("revealRecoveryKey");

        // execution
        String type = GraphQLTypeUtil.simplePrint(mutation.getType());

        // verifications
        assertThat(type).isEqualTo("RecoveryKey!");
        assertThat(GraphQLTypeUtil.simplePrint(mutation.getArgument("machineId").getType())).isEqualTo("String!");
        assertThat(schema.getQueryType().getFieldDefinition("revealRecoveryKey")).isNull();
    }

    @Test
    void wipeWindowsDeviceInput_requiresConfirmation() {
        // setup
        GraphQLInputObjectType input = schema.getTypeAs("WipeWindowsDeviceInput");

        // execution
        GraphQLType confirmation = input.getField("confirmation").getType();

        // verifications
        assertThat(GraphQLTypeUtil.simplePrint(confirmation)).isEqualTo("String!");
    }

    @Test
    void lockWindowsDeviceInput_messageOptional() {
        // setup
        GraphQLInputObjectType input = schema.getTypeAs("LockWindowsDeviceInput");

        // execution
        GraphQLType message = input.getField("message").getType();

        // verifications
        assertThat(message).isNotInstanceOf(GraphQLNonNull.class);
        assertThat(input.getField("machineId").getType()).isInstanceOf(GraphQLNonNull.class);
    }

    @Test
    void deviceFilters_extendedWithMdmAndEncryption() {
        // setup
        GraphQLObjectType filters = schema.getObjectType("DeviceFilters");
        GraphQLInputObjectType input = schema.getTypeAs("DeviceFilterInput");

        // execution
        String mdmOptions = GraphQLTypeUtil.simplePrint(filters.getFieldDefinition("mdmStates").getType());
        String encOptions = GraphQLTypeUtil.simplePrint(filters.getFieldDefinition("diskEncryptionStates").getType());
        String mdmInput = GraphQLTypeUtil.simplePrint(input.getField("mdmStates").getType());
        String encInput = GraphQLTypeUtil.simplePrint(input.getField("diskEncryptionStates").getType());

        // verifications
        assertThat(mdmOptions).isEqualTo("[DeviceFilterOption!]!");
        assertThat(encOptions).isEqualTo("[DeviceFilterOption!]!");
        assertThat(mdmInput).isEqualTo("[MdmEnrollmentState!]");
        assertThat(encInput).isEqualTo("[DiskEncryptionState!]");
    }

    @Test
    void windowsMdmSettingsImpact_takesTheSameInputAsTheUpdate() {
        // setup
        GraphQLFieldDefinition impact = schema.getQueryType().getFieldDefinition("windowsMdmSettingsImpact");
        GraphQLFieldDefinition update = schema.getMutationType().getFieldDefinition("updateWindowsMdmSettings");

        // execution
        String impactInput = GraphQLTypeUtil.simplePrint(impact.getArgument("input").getType());
        String updateInput = GraphQLTypeUtil.simplePrint(update.getArgument("input").getType());

        // verifications
        assertThat(impactInput).isEqualTo("UpdateWindowsMdmSettingsInput!");
        assertThat(updateInput).isEqualTo(impactInput);
    }

    @Test
    void mdmProfileDevices_pagedPerProfile() {
        // setup
        GraphQLFieldDefinition query = schema.getQueryType().getFieldDefinition("mdmProfileDevices");

        // execution
        String type = GraphQLTypeUtil.simplePrint(query.getType());

        // verifications
        assertThat(type).isEqualTo("MdmProfileDeviceConnection!");
        assertThat(GraphQLTypeUtil.simplePrint(query.getArgument("profileId").getType())).isEqualTo("ID!");
    }

    @Test
    void mdmDeviceEvents_pagedPerDevice() {
        // setup
        GraphQLFieldDefinition query = schema.getQueryType().getFieldDefinition("mdmDeviceEvents");

        // execution
        String type = GraphQLTypeUtil.simplePrint(query.getType());

        // verifications
        assertThat(type).isEqualTo("MdmDeviceEventConnection!");
        assertThat(query.getArgument("machineId").getType()).isInstanceOf(GraphQLNonNull.class);
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
