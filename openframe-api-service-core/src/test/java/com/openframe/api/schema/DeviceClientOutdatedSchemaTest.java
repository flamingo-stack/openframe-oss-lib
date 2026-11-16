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

class DeviceClientOutdatedSchemaTest {

    private static TypeDefinitionRegistry registry;

    @BeforeAll
    static void parseSchema() throws Exception {
        registry = new SchemaParser().parse(read("schema/device.graphqls"));
    }

    @Test
    void machine_clientOutdated_nonNullBoolean() {
        // execution
        FieldDefinition clientOutdated = field("Machine", "clientOutdated");

        // verifications
        assertThat(clientOutdated.getType()).isInstanceOf(NonNullType.class);
        assertThat(((NonNullType) clientOutdated.getType()).getType())
                .isInstanceOfSatisfying(TypeName.class, type -> assertThat(type.getName()).isEqualTo("Boolean"));
    }

    @Test
    void deviceFilterInput_clientOutdated_optionalBoolean() {
        // setup
        InputObjectTypeDefinition input = registry.getType("DeviceFilterInput", InputObjectTypeDefinition.class).orElseThrow();

        // execution
        Type<?> clientOutdated = input.getInputValueDefinitions().stream()
                .filter(value -> value.getName().equals("clientOutdated"))
                .map(InputValueDefinition::getType)
                .findFirst().orElseThrow();

        // verifications
        assertThat(clientOutdated)
                .isInstanceOfSatisfying(TypeName.class, type -> assertThat(type.getName()).isEqualTo("Boolean"));
    }

    @Test
    void deviceFilters_clientOutdated_nonNullListOfNonNullOptions() {
        // execution
        FieldDefinition clientOutdated = field("DeviceFilters", "clientOutdated");

        // verifications
        assertThat(clientOutdated.getType()).isInstanceOf(NonNullType.class);
        Type<?> list = ((NonNullType) clientOutdated.getType()).getType();
        assertThat(list).isInstanceOf(ListType.class);
        Type<?> element = ((ListType) list).getType();
        assertThat(element).isInstanceOf(NonNullType.class);
        assertThat(((NonNullType) element).getType())
                .isInstanceOfSatisfying(TypeName.class, type -> assertThat(type.getName()).isEqualTo("DeviceFilterOption"));
    }

    @Test
    void deviceStatus_outdatedIsNotAStatusValue() {
        // execution
        EnumTypeDefinition status = registry.getType("DeviceStatus", EnumTypeDefinition.class).orElseThrow();

        // verifications
        assertThat(status.getEnumValueDefinitions())
                .extracting(EnumValueDefinition::getName)
                .doesNotContain("OUTDATED");
    }

    private static FieldDefinition field(String typeName, String fieldName) {
        ObjectTypeDefinition type = registry.getType(typeName, ObjectTypeDefinition.class).orElseThrow();
        return type.getFieldDefinitions().stream()
                .filter(field -> field.getName().equals(fieldName))
                .findFirst().orElseThrow();
    }

    private static String read(String resource) throws Exception {
        try (InputStream in = DeviceClientOutdatedSchemaTest.class.getClassLoader().getResourceAsStream(resource)) {
            assertThat(in).as(resource).isNotNull();
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
