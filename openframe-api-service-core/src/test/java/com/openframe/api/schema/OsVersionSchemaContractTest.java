package com.openframe.api.schema;

import graphql.language.AstPrinter;
import graphql.language.FieldDefinition;
import graphql.language.InputObjectTypeDefinition;
import graphql.language.InputValueDefinition;
import graphql.language.ObjectTypeDefinition;
import graphql.language.ObjectTypeExtensionDefinition;
import graphql.schema.idl.SchemaParser;
import graphql.schema.idl.TypeDefinitionRegistry;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

class OsVersionSchemaContractTest {

    private static TypeDefinitionRegistry schema;

    @BeforeAll
    static void readTheSchemaFilesOfTheModule() throws IOException {
        schema = new TypeDefinitionRegistry();
        SchemaParser parser = new SchemaParser();
        Resource[] files = new PathMatchingResourcePatternResolver().getResources("classpath:schema/*.graphqls");
        for (Resource file : files) {
            schema.merge(parser.parse(file.getContentAsString(StandardCharsets.UTF_8)));
        }
    }

    @Test
    void osVersions_rootQueryWithOrganizationFilterAndRelayArguments() {
        // setup

        // execution
        FieldDefinition query = queryField("osVersions");

        // verifications
        assertThat(arguments(query.getInputValueDefinitions())).containsExactlyInAnyOrderEntriesOf(
                Map.of("filter", "OsVersionFilterInput", "first", "Int", "after", "String"));
        assertThat(AstPrinter.printAst(query.getType())).isEqualTo("OsVersionConnection!");
        InputObjectTypeDefinition filter = schema.getType("OsVersionFilterInput", InputObjectTypeDefinition.class)
                .orElseThrow();
        assertThat(arguments(filter.getInputValueDefinitions()))
                .containsExactlyInAnyOrderEntriesOf(Map.of("organizationIds", "[String!]"));
    }

    @Test
    void osVersionDevices_rootQueryByVersionWithOrganizationsAndRelayArguments() {
        // setup
        Map<String, String> expected = new LinkedHashMap<>();
        expected.put("osVersion", "String!");
        expected.put("organizationIds", "[String!]");
        expected.put("first", "Int");
        expected.put("after", "String");

        // execution
        FieldDefinition query = queryField("osVersionDevices");

        // verifications
        assertThat(arguments(query.getInputValueDefinitions())).containsExactlyEntriesOf(expected);
        assertThat(AstPrinter.printAst(query.getType())).isEqualTo("OsVersionDeviceConnection!");
    }

    @Test
    void osVersion_countsRequiredAndTheReferenceFieldsNullable() {
        // setup
        Map<String, String> expected = new LinkedHashMap<>();
        expected.put("osVersion", "String!");
        expected.put("deviceCount", "Int!");
        expected.put("devicesBehindCount", "Int");
        expected.put("currentBuild", "String");
        expected.put("endOfSupportAt", "Date");
        expected.put("supportEnded", "Boolean");
        expected.put("enterpriseEndOfSupportAt", "Date");
        expected.put("enterpriseSupportEnded", "Boolean");

        // execution
        Map<String, String> fields = fields("OsVersion");

        // verifications
        assertThat(fields).containsExactlyEntriesOf(expected);
    }

    @Test
    void osVersionDevice_machineBuildAndNullableFlagAndEndOfSupport() {
        // setup
        Map<String, String> expected = new LinkedHashMap<>();
        expected.put("machineId", "String!");
        expected.put("osBuild", "String");
        expected.put("osProductName", "String");
        expected.put("upToDate", "Boolean");
        expected.put("endOfSupportAt", "Date");
        expected.put("supportEnded", "Boolean");
        expected.put("machine", "Machine");

        // execution
        Map<String, String> fields = fields("OsVersionDevice");

        // verifications
        assertThat(fields).containsExactlyEntriesOf(expected);
    }

    @Test
    void connections_relayEdgesAndPageInfo() {
        // setup

        // execution
        Map<String, String> versions = fields("OsVersionConnection");
        Map<String, String> versionEdge = fields("OsVersionEdge");
        Map<String, String> devices = fields("OsVersionDeviceConnection");
        Map<String, String> deviceEdge = fields("OsVersionDeviceEdge");

        // verifications
        assertThat(versions).containsExactlyInAnyOrderEntriesOf(Map.of("edges", "[OsVersionEdge!]!", "pageInfo", "PageInfo!"));
        assertThat(versionEdge).containsExactlyInAnyOrderEntriesOf(Map.of("node", "OsVersion!", "cursor", "String!"));
        assertThat(devices)
                .containsExactlyInAnyOrderEntriesOf(Map.of("edges", "[OsVersionDeviceEdge!]!", "pageInfo", "PageInfo!"));
        assertThat(deviceEdge).containsExactlyInAnyOrderEntriesOf(Map.of("node", "OsVersionDevice!", "cursor", "String!"));
    }

    private static FieldDefinition queryField(String name) {
        Stream<FieldDefinition> declared = schema.getType("Query", ObjectTypeDefinition.class).stream()
                .flatMap(query -> query.getFieldDefinitions().stream());
        Stream<FieldDefinition> extended = schema.objectTypeExtensions().getOrDefault("Query", List.of()).stream()
                .map(ObjectTypeExtensionDefinition::getFieldDefinitions)
                .flatMap(List::stream);
        return Stream.concat(declared, extended).filter(field -> field.getName().equals(name)).findFirst()
                .orElseThrow(() -> new AssertionError("Query." + name + " is missing"));
    }

    private static Map<String, String> fields(String typeName) {
        ObjectTypeDefinition type = schema.getType(typeName, ObjectTypeDefinition.class)
                .orElseThrow(() -> new AssertionError(typeName + " is missing"));
        Map<String, String> fields = new LinkedHashMap<>();
        type.getFieldDefinitions().forEach(field -> fields.put(field.getName(), AstPrinter.printAst(field.getType())));
        return fields;
    }

    private static Map<String, String> arguments(List<InputValueDefinition> inputValues) {
        Map<String, String> arguments = new LinkedHashMap<>();
        inputValues.forEach(input -> arguments.put(input.getName(), AstPrinter.printAst(input.getType())));
        return arguments;
    }
}
