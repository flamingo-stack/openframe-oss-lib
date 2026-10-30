package com.openframe.api.schema;

import com.apollographql.federation.graphqljava.Federation;
import com.openframe.data.document.device.DirectorySource;
import com.openframe.data.document.device.DirectoryUserLink;
import com.openframe.data.document.ticket.TicketCreationSource;
import com.openframe.data.document.ticket.TicketStatus;
import graphql.ExecutionResult;
import graphql.GraphQL;
import graphql.schema.GraphQLAppliedDirective;
import graphql.schema.GraphQLAppliedDirectiveArgument;
import graphql.schema.GraphQLDirectiveContainer;
import graphql.schema.GraphQLEnumType;
import graphql.schema.GraphQLEnumValueDefinition;
import graphql.schema.GraphQLFieldDefinition;
import graphql.schema.GraphQLInputObjectField;
import graphql.schema.GraphQLInputObjectType;
import graphql.schema.GraphQLObjectType;
import graphql.schema.GraphQLSchema;
import graphql.schema.GraphQLTypeUtil;
import graphql.schema.idl.RuntimeWiring;
import graphql.schema.idl.SchemaParser;
import graphql.schema.idl.TypeDefinitionRegistry;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

class ApiSubgraphSchemaTest {

    private static final String SCHEMA_FILES = "classpath*:schema/**/*.graphqls";
    private static final String FEDERATION_URL = "https://specs.apollo.dev/federation/v2.5";
    private static final String SERVICE_SDL_QUERY = "{ _service { sdl } }";
    private static final String AI_AGENT = "ai-agent";

    private static GraphQLSchema schema;

    @BeforeAll
    static void buildFederatedSchema() throws IOException {
        TypeDefinitionRegistry registry = loadSchemaFiles();
        schema = Federation.transform(registry, RuntimeWiring.MOCKED_WIRING)
                .fetchEntities(environment -> List.of())
                .resolveEntityType(environment -> null)
                .build();
    }

    @Test
    void serviceSdl_federationLink_federationTwoPointFive() {
        // execution
        String sdl = serviceSdl();

        // verifications
        assertThat(sdl).contains(FEDERATION_URL);
    }

    @ParameterizedTest
    @ValueSource(strings = {"node", "nodes"})
    void relayRootField_overriddenFromAiAgent(String field) {
        // setup
        GraphQLFieldDefinition definition = schema.getQueryType().getFieldDefinition(field);

        // execution
        Object from = appliedArgument(definition, "override", "from");

        // verifications
        assertThat(from).isEqualTo(AI_AGENT);
    }

    @ParameterizedTest
    @ValueSource(strings = {"PageInfo", "TempAttachment", "UserImage"})
    void valueType_shareable(String type) {
        // setup
        GraphQLObjectType definition = schema.getObjectType(type);

        // execution
        boolean shareable = definition.hasAppliedDirective("shareable");

        // verifications
        assertThat(shareable).isTrue();
    }

    @ParameterizedTest
    @MethodSource("entityKeys")
    void entity_keyFields(String type, String keyFields) {
        // setup
        GraphQLObjectType definition = schema.getObjectType(type);

        // execution
        Object fields = appliedArgument(definition, "key", "fields");

        // verifications
        assertThat(fields).isEqualTo(keyFields);
    }

    @ParameterizedTest
    @ValueSource(strings = {"Ticket", "TicketStatusDefinition"})
    void aiAgentOwnedCopy_keyNotResolvable(String type) {
        // setup
        GraphQLObjectType definition = schema.getObjectType(type);

        // execution
        Object resolvable = appliedArgument(definition, "key", "resolvable");

        // verifications
        assertThat(resolvable).isEqualTo(false);
    }

    @ParameterizedTest
    @ValueSource(strings = {"User", "Machine", "Ticket", "TicketStatusDefinition"})
    void sharedEntity_shareable(String type) {
        // setup
        GraphQLObjectType definition = schema.getObjectType(type);

        // execution
        boolean shareable = definition.hasAppliedDirective("shareable");

        // verifications
        assertThat(shareable).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"id", "name"})
    void organization_nonKeyFieldServedByAiAgent_shareable(String field) {
        // setup
        GraphQLFieldDefinition definition = schema.getObjectType("Organization").getFieldDefinition(field);

        // execution
        boolean shareable = definition.hasAppliedDirective("shareable");

        // verifications
        assertThat(shareable).isTrue();
    }

    @Test
    void organization_key_resolvableHere() {
        // setup
        GraphQLObjectType definition = schema.getObjectType("Organization");

        // execution
        Object resolvable = appliedArgument(definition, "key", "resolvable");

        // verifications
        assertThat(resolvable).isEqualTo(true);
    }

    @ParameterizedTest
    @MethodSource("ticketEnumFields")
    void ticketCopy_enumTypedLikeAiAgent(String field, String type) {
        // setup
        GraphQLFieldDefinition definition = schema.getObjectType("Ticket").getFieldDefinition(field);

        // execution
        String printed = GraphQLTypeUtil.simplePrint(definition.getType());

        // verifications
        assertThat(printed).isEqualTo(type);
    }

    @ParameterizedTest
    @MethodSource("ticketEnums")
    void ticketEnum_valuesEqualJavaEnum(String type, Class<? extends Enum<?>> javaEnum) {
        // setup
        List<String> javaNames = javaEnumNames(javaEnum);

        // execution
        List<String> sdlNames = sdlEnumNames(type);

        // verifications
        assertThat(sdlNames).containsExactlyInAnyOrderElementsOf(javaNames);
    }

    @ParameterizedTest
    @MethodSource("machineDirectoryFields")
    void machineDirectoryField_typedLikeTheContract(String field, String type) {
        // setup
        GraphQLFieldDefinition definition = schema.getObjectType("Machine").getFieldDefinition(field);

        // execution
        String printed = GraphQLTypeUtil.simplePrint(definition.getType());

        // verifications
        assertThat(printed).isEqualTo(type);
    }

    @Test
    void machine_computerName_notExposed() {
        // setup
        GraphQLObjectType machine = schema.getObjectType("Machine");

        // execution
        GraphQLFieldDefinition computerName = machine.getFieldDefinition("computerName");

        // verifications
        assertThat(computerName).isNull();
    }

    @ParameterizedTest
    @MethodSource("deviceFilterInputDirectoryFields")
    void deviceFilterInputDirectoryField_typedLikeTheContract(String field, String type) {
        // setup
        GraphQLInputObjectType input = schema.getTypeAs("DeviceFilterInput");
        GraphQLInputObjectField definition = input.getFieldDefinition(field);

        // execution
        String printed = GraphQLTypeUtil.simplePrint(definition.getType());

        // verifications
        assertThat(printed).isEqualTo(type);
    }

    @ParameterizedTest
    @ValueSource(strings = {"directorySources", "userLinks"})
    void deviceFiltersDirectoryFacet_nonNullOptionList(String field) {
        // setup
        GraphQLFieldDefinition definition = schema.getObjectType("DeviceFilters").getFieldDefinition(field);

        // execution
        String printed = GraphQLTypeUtil.simplePrint(definition.getType());

        // verifications
        assertThat(printed).isEqualTo("[DeviceFilterOption!]!");
    }

    @ParameterizedTest
    @MethodSource("directoryEnums")
    void directoryEnum_valuesEqualJavaEnum(String type, Class<? extends Enum<?>> javaEnum) {
        // setup
        List<String> javaNames = javaEnumNames(javaEnum);

        // execution
        List<String> sdlNames = sdlEnumNames(type);

        // verifications
        assertThat(sdlNames).containsExactlyInAnyOrderElementsOf(javaNames);
    }

    @Test
    void entities_rootFieldAdded() {
        // execution
        GraphQLFieldDefinition entities = schema.getQueryType().getFieldDefinition("_entities");

        // verifications
        assertThat(entities).isNotNull();
    }

    private static Stream<Arguments> entityKeys() {
        return Stream.of(
                Arguments.of("User", "id"),
                Arguments.of("Machine", "machineId"),
                Arguments.of("Organization", "organizationId"),
                Arguments.of("Ticket", "id"),
                Arguments.of("TicketStatusDefinition", "id"));
    }

    private static Stream<Arguments> ticketEnumFields() {
        return Stream.of(
                Arguments.of("status", "TicketStatus"),
                Arguments.of("creationSource", "TicketCreationSource"));
    }

    private static Stream<Arguments> ticketEnums() {
        return Stream.of(
                Arguments.of("TicketStatus", TicketStatus.class),
                Arguments.of("TicketCreationSource", TicketCreationSource.class));
    }

    private static Stream<Arguments> machineDirectoryFields() {
        return Stream.of(
                Arguments.of("directorySources", "[DirectorySource!]!"),
                Arguments.of("directoryUserLink", "DirectoryUserLink!"),
                Arguments.of("directoryUserIds", "[String!]!"),
                Arguments.of("directoryUserName", "String"));
    }

    private static Stream<Arguments> deviceFilterInputDirectoryFields() {
        return Stream.of(
                Arguments.of("directorySources", "[DirectorySource!]"),
                Arguments.of("userLinks", "[DirectoryUserLink!]"));
    }

    private static Stream<Arguments> directoryEnums() {
        return Stream.of(
                Arguments.of("DirectorySource", DirectorySource.class),
                Arguments.of("DirectoryUserLink", DirectoryUserLink.class));
    }

    private static List<String> sdlEnumNames(String type) {
        GraphQLEnumType definition = schema.getTypeAs(type);
        return definition.getValues().stream()
                .map(GraphQLEnumValueDefinition::getName)
                .toList();
    }

    private static List<String> javaEnumNames(Class<? extends Enum<?>> javaEnum) {
        Enum<?>[] constants = javaEnum.getEnumConstants();
        return Arrays.stream(constants)
                .map(Enum::name)
                .toList();
    }

    private static TypeDefinitionRegistry loadSchemaFiles() throws IOException {
        TypeDefinitionRegistry registry = new TypeDefinitionRegistry();
        SchemaParser parser = new SchemaParser();
        Resource[] files = new PathMatchingResourcePatternResolver().getResources(SCHEMA_FILES);
        for (Resource file : files) {
            TypeDefinitionRegistry fileDefinitions = parse(parser, file);
            registry.merge(fileDefinitions);
        }
        return registry;
    }

    private static TypeDefinitionRegistry parse(SchemaParser parser, Resource file) throws IOException {
        try (Reader reader = new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8)) {
            return parser.parse(reader);
        }
    }

    private static String serviceSdl() {
        GraphQL graphQL = GraphQL.newGraphQL(schema).build();
        ExecutionResult result = graphQL.execute(SERVICE_SDL_QUERY);
        Map<String, Map<String, String>> data = result.getData();
        Map<String, String> service = data.get("_service");
        return service.get("sdl");
    }

    private static Object appliedArgument(GraphQLDirectiveContainer element, String directive, String argument) {
        GraphQLAppliedDirective applied = element.getAppliedDirective(directive);
        GraphQLAppliedDirectiveArgument value = applied.getArgument(argument);
        return value.getValue();
    }
}
