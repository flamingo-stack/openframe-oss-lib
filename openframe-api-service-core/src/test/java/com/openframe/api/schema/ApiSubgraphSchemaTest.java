package com.openframe.api.schema;

import com.apollographql.federation.graphqljava.Federation;
import graphql.ExecutionResult;
import graphql.GraphQL;
import graphql.schema.GraphQLAppliedDirective;
import graphql.schema.GraphQLAppliedDirectiveArgument;
import graphql.schema.GraphQLDirectiveContainer;
import graphql.schema.GraphQLFieldDefinition;
import graphql.schema.GraphQLObjectType;
import graphql.schema.GraphQLSchema;
import graphql.schema.idl.RuntimeWiring;
import graphql.schema.idl.SchemaParser;
import graphql.schema.idl.TypeDefinitionRegistry;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

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
