package com.openframe.api.schema;

import graphql.language.AstPrinter;
import graphql.language.EnumTypeDefinition;
import graphql.language.EnumValueDefinition;
import graphql.language.FieldDefinition;
import graphql.language.InputValueDefinition;
import graphql.language.ListType;
import graphql.language.NonNullType;
import graphql.language.ObjectTypeDefinition;
import graphql.language.ObjectTypeExtensionDefinition;
import graphql.language.Type;
import graphql.language.TypeName;
import graphql.schema.idl.SchemaParser;
import graphql.schema.idl.TypeDefinitionRegistry;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The device OS tab part of the API, as design.md of CU-17tkuw67mjf pass 1 gives it and as frontend receives it.
 * The field sets are exact: a field the pass left out (patchStatus, type, cves, supportState, anything reading as
 * "up to date") arrives with its own pass and its own line here.
 */
class OsUpdateSchemaContractTest {

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

    // design.md, ruling 11: the OS state is its own query, the device type is the one of main
    @Test
    void machine_hasNoOsStateField_keepsItsOwnVersionAndBuild() {
        // setup

        // execution
        Map<String, String> machine = fields("Machine");

        // verifications
        assertThat(machine).doesNotContainKey("osState")
                .containsEntry("osVersion", "String")
                .containsEntry("osBuild", "String");
    }

    @Test
    void deviceSchemaFile_namesNothingOfTheOsUpdateFeature_itsTypesAreInTheOsUpdateFile() throws IOException {
        // setup
        SchemaParser parser = new SchemaParser();

        // execution
        String deviceFile = new ClassPathResource("schema/device.graphqls").getContentAsString(StandardCharsets.UTF_8);
        TypeDefinitionRegistry osUpdateFile = parser.parse(
                new ClassPathResource("schema/os-update.graphqls").getContentAsString(StandardCharsets.UTF_8));

        // verifications
        assertThat(deviceFile).as("schema/device.graphqls").doesNotContain("osState", "DeviceOsState", "OsUpdate");
        assertThat(osUpdateFile.getType("DeviceOsState", ObjectTypeDefinition.class))
                .as("type DeviceOsState in schema/os-update.graphqls").isPresent();
        assertThat(List.of("OsUpdateManagementState", "OsUpdateManagedElsewhereReason", "OsUpdateObservedReason",
                "OsUpdateAuthorization"))
                .as("enums in schema/os-update.graphqls")
                .allSatisfy(name -> assertThat(osUpdateFile.getType(name, EnumTypeDefinition.class)).as(name).isPresent());
    }

    @Test
    void deviceOsState_rootQueryByMachineId_nullForADeviceThatNeverReported() {
        // setup

        // execution
        Optional<FieldDefinition> query = queryField("deviceOsState");

        // verifications
        assertThat(query).as("Query.deviceOsState").isPresent();
        assertThat(arguments(query.get())).containsExactlyInAnyOrderEntriesOf(Map.of("machineId", "String!"));
        assertThat(print(query.get().getType())).isEqualTo("DeviceOsState");
    }

    @Test
    void deviceOsState_exactlyTheFieldsOfThePass() {
        // setup

        // execution
        Map<String, String> osState = fields("DeviceOsState");

        // verifications
        Map<String, String> expected = new LinkedHashMap<>();
        expected.put("osVersion", "String");
        expected.put("osBuild", "String");
        expected.put("restartPending", "Boolean");
        expected.put("restartPendingSince", "Instant");
        expected.put("lastScanAt", "Instant");
        expected.put("lastScanError", "String");
        expected.put("lastInstalledAt", "Instant");
        expected.put("managementState", "OsUpdateManagementState");
        expected.put("managedElsewhereReason", "OsUpdateManagedElsewhereReason");
        expected.put("observedReason", "OsUpdateObservedReason");
        expected.put("authorization", "OsUpdateAuthorization");
        expected.put("receivedAt", "Instant!");
        assertThat(osState).containsExactlyInAnyOrderEntriesOf(expected);
    }

    @Test
    void deviceOsUpdate_exactlyTheFieldsOfThePass() {
        // setup

        // execution
        Map<String, String> update = fields("DeviceOsUpdate");

        // verifications
        Map<String, String> expected = new LinkedHashMap<>();
        expected.put("updateKey", "String!");
        expected.put("title", "String!");
        expected.put("version", "String");
        expected.put("kbArticleIds", "[String!]!");
        expected.put("severity", "OsUpdateSeverity");
        expected.put("categories", "[String!]!");
        expected.put("browseOnly", "Boolean");
        expected.put("publishedAt", "Instant");
        expected.put("sizeBytes", "Long");
        expected.put("restartBehaviour", "OsUpdateRestartBehaviour");
        expected.put("discoveredAt", "Instant!");
        assertThat(update).containsExactlyInAnyOrderEntriesOf(expected);
    }

    @Test
    void deviceOsUpdateHistoryEntry_exactlyTheFieldsOfThePass() {
        // setup

        // execution
        Map<String, String> entry = fields("DeviceOsUpdateHistoryEntry");

        // verifications
        assertThat(entry).containsExactlyInAnyOrderEntriesOf(Map.of(
                "updateKey", "String",
                "title", "String!",
                "version", "String",
                "installedAt", "Instant!",
                "operation", "OsUpdateOperation",
                "result", "OsUpdateInstallResult",
                "errorCode", "String"));
    }

    @Test
    void enums_exactlyTheValuesOfThePass() {
        // setup

        // execution
        List<String> managementState = enumValues("OsUpdateManagementState");
        List<String> managedElsewhereReason = enumValues("OsUpdateManagedElsewhereReason");
        List<String> observedReason = enumValues("OsUpdateObservedReason");
        List<String> authorization = enumValues("OsUpdateAuthorization");
        List<String> severity = enumValues("OsUpdateSeverity");
        List<String> restartBehaviour = enumValues("OsUpdateRestartBehaviour");
        List<String> operation = enumValues("OsUpdateOperation");
        List<String> installResult = enumValues("OsUpdateInstallResult");

        // verifications
        assertThat(managementState).containsExactly("MANAGED", "MANAGED_ELSEWHERE", "OBSERVED");
        assertThat(managedElsewhereReason).containsExactly("GPO", "WSUS", "MDM", "CONFIGMGR");
        assertThat(observedReason).containsExactly("HOME_EDITION", "WRITE_FILTER");
        assertThat(authorization).containsExactly("AUTHORIZED", "NOT_AUTHORIZED", "NOT_REQUIRED");
        assertThat(severity).containsExactly("CRITICAL", "IMPORTANT", "MODERATE", "LOW");
        assertThat(restartBehaviour).containsExactly("NEVER", "MAY_REQUIRE", "ALWAYS");
        assertThat(operation).containsExactly("INSTALL", "UNINSTALL");
        assertThat(installResult).containsExactly("SUCCEEDED", "SUCCEEDED_WITH_ERRORS", "FAILED", "ABORTED");
    }

    @Test
    void deviceOsUpdates_listOfTheDevice_notPaginated() {
        // setup

        // execution
        Optional<FieldDefinition> query = queryField("deviceOsUpdates");

        // verifications
        assertThat(query).as("Query.deviceOsUpdates").isPresent();
        assertThat(arguments(query.get())).containsExactlyInAnyOrderEntriesOf(Map.of("machineId", "String!"));
        assertThat(print(query.get().getType())).isEqualTo("[DeviceOsUpdate!]!");
    }

    @Test
    void deviceOsUpdateHistory_forwardPagedConnectionOfHistoryEntries() {
        // setup

        // execution
        Optional<FieldDefinition> query = queryField("deviceOsUpdateHistory");

        // verifications
        assertThat(query).as("Query.deviceOsUpdateHistory").isPresent();
        assertThat(arguments(query.get())).containsExactlyInAnyOrderEntriesOf(
                Map.of("machineId", "String!", "first", "Int", "after", "String"));
        assertThat(print(query.get().getType())).isEqualTo("DeviceOsUpdateHistoryConnection!");
        Map<String, String> connection = fields("DeviceOsUpdateHistoryConnection");
        assertThat(connection).containsEntry("pageInfo", "PageInfo!").containsKey("edges");
        Map<String, String> edge = fields(elementTypeName("DeviceOsUpdateHistoryConnection", "edges"));
        assertThat(edge).containsEntry("node", "DeviceOsUpdateHistoryEntry!").containsEntry("cursor", "String!");
    }

    private static Map<String, String> fields(String typeName) {
        Optional<ObjectTypeDefinition> type = schema.getType(typeName, ObjectTypeDefinition.class);
        assertThat(type).as("type %s in schema/*.graphqls", typeName).isPresent();
        Map<String, String> fields = new LinkedHashMap<>();
        for (FieldDefinition field : type.get().getFieldDefinitions()) {
            fields.put(field.getName(), print(field.getType()));
        }
        return fields;
    }

    private static String elementTypeName(String typeName, String fieldName) {
        ObjectTypeDefinition type = schema.getType(typeName, ObjectTypeDefinition.class).orElseThrow();
        Type<?> fieldType = type.getFieldDefinitions().stream()
                .filter(field -> field.getName().equals(fieldName))
                .findFirst().orElseThrow().getType();
        while (!(fieldType instanceof TypeName)) {
            fieldType = fieldType instanceof NonNullType nonNull ? nonNull.getType() : ((ListType) fieldType).getType();
        }
        return ((TypeName) fieldType).getName();
    }

    private static List<String> enumValues(String typeName) {
        Optional<EnumTypeDefinition> type = schema.getType(typeName, EnumTypeDefinition.class);
        assertThat(type).as("enum %s in schema/*.graphqls", typeName).isPresent();
        return type.get().getEnumValueDefinitions().stream().map(EnumValueDefinition::getName).toList();
    }

    private static Optional<FieldDefinition> queryField(String name) {
        Stream<FieldDefinition> declared = schema.getType("Query", ObjectTypeDefinition.class).stream()
                .flatMap(query -> query.getFieldDefinitions().stream());
        Stream<FieldDefinition> extended = schema.objectTypeExtensions().getOrDefault("Query", List.of()).stream()
                .map(ObjectTypeExtensionDefinition::getFieldDefinitions)
                .flatMap(List::stream);
        return Stream.concat(declared, extended).filter(field -> field.getName().equals(name)).findFirst();
    }

    private static Map<String, String> arguments(FieldDefinition field) {
        Map<String, String> arguments = new LinkedHashMap<>();
        for (InputValueDefinition argument : field.getInputValueDefinitions()) {
            arguments.put(argument.getName(), print(argument.getType()));
        }
        return arguments;
    }

    private static String print(Type<?> type) {
        return AstPrinter.printAst(type);
    }
}
