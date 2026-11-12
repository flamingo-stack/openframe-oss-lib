package com.openframe.api.schema;

import graphql.language.EnumTypeDefinition;
import graphql.language.EnumValueDefinition;
import graphql.language.FieldDefinition;
import graphql.language.InputObjectTypeDefinition;
import graphql.language.InputValueDefinition;
import graphql.language.ListType;
import graphql.language.NonNullType;
import graphql.language.ObjectTypeDefinition;
import graphql.language.Type;
import graphql.language.TypeName;
import graphql.schema.idl.SchemaParser;
import graphql.schema.idl.TypeDefinitionRegistry;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

// Phase 1 of CU-86akb8vvf: connectivity is exposed next to status without changing what status means.
class DeviceConnectivitySchemaTest {

    private static TypeDefinitionRegistry registry;

    @BeforeAll
    static void parseSchema() throws Exception {
        registry = new SchemaParser().parse(read("schema/device.graphqls"));
        registry.merge(new SchemaParser().parse(read("schema/software-action.graphqls")));
    }

    @Test
    void deviceConnectivityEnum_hasOnlineAndOffline() {
        // execution
        EnumTypeDefinition connectivity = registry.getType("DeviceConnectivity", EnumTypeDefinition.class).orElseThrow();

        // verifications
        assertThat(connectivity.getEnumValueDefinitions())
                .extracting(EnumValueDefinition::getName)
                .containsExactly("ONLINE", "OFFLINE");
    }

    @Test
    void machine_exposesNullableConnectivity() {
        // execution
        FieldDefinition connectivity = field("Machine", "connectivity");

        // verifications
        assertThat(typeName(connectivity)).isEqualTo("DeviceConnectivity");
    }

    @Test
    void machine_keepsStatus() {
        // execution
        FieldDefinition status = field("Machine", "status");

        // verifications
        assertThat(typeName(status)).isEqualTo("DeviceStatus");
    }

    @Test
    void deviceFilterInput_acceptsOptionalConnectivityList() {
        // execution
        InputObjectTypeDefinition input = registry.getType("DeviceFilterInput", InputObjectTypeDefinition.class).orElseThrow();
        Type<?> connectivity = input.getInputValueDefinitions().stream()
                .filter(value -> value.getName().equals("connectivity"))
                .map(InputValueDefinition::getType)
                .findFirst().orElseThrow();

        // verifications
        assertThat(connectivity).isInstanceOf(ListType.class);
        assertThat(((ListType) connectivity).getType()).isInstanceOf(NonNullType.class);
    }

    @Test
    void deviceFilters_exposesNonNullConnectivityOptions() {
        // execution
        FieldDefinition connectivity = field("DeviceFilters", "connectivity");

        // verifications
        assertThat(connectivity.getType()).isInstanceOf(NonNullType.class);
        assertThat(((NonNullType) connectivity.getType()).getType()).isInstanceOf(ListType.class);
    }

    @Test
    void softwareActionDevice_exposesConnectivityNextToDeviceStatus() {
        // execution
        FieldDefinition connectivity = field("SoftwareActionDevice", "connectivity");
        FieldDefinition deviceStatus = field("SoftwareActionDevice", "deviceStatus");

        // verifications
        assertThat(typeName(connectivity)).isEqualTo("DeviceConnectivity");
        assertThat(typeName(deviceStatus)).isEqualTo("DeviceStatus");
    }

    private static String typeName(FieldDefinition field) {
        return ((TypeName) field.getType()).getName();
    }

    private static FieldDefinition field(String typeName, String fieldName) {
        ObjectTypeDefinition type = registry.getType(typeName, ObjectTypeDefinition.class).orElseThrow();
        return type.getFieldDefinitions().stream()
                .filter(field -> field.getName().equals(fieldName))
                .findFirst().orElseThrow();
    }

    private static String read(String resource) throws Exception {
        try (InputStream in = DeviceConnectivitySchemaTest.class.getClassLoader().getResourceAsStream(resource)) {
            assertThat(in).as(resource).isNotNull();
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
