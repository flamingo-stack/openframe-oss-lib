package com.openframe.core.jackson;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.jackson.autoconfigure.JacksonAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import tools.jackson.databind.exc.MismatchedInputException;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class Jackson2CompatibilityAutoConfigurationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(JacksonAutoConfiguration.class, Jackson2CompatibilityAutoConfiguration.class));

    record Payload(String id, boolean verified, int count) {
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    static class WithDefaults {
        private String id;
        private String kind = "GUIDE";
        private boolean verified;
    }

    static class OnlyArgsConstructor {
        private final String id;
        private final int count;

        public OnlyArgsConstructor(String id, int count) {
            this.id = id;
            this.count = count;
        }

        public String getId() {
            return id;
        }

        public int getCount() {
            return count;
        }
    }

    static class ExplicitCreator {
        private final String id;

        ExplicitCreator() {
            this.id = "unused";
        }

        @JsonCreator
        ExplicitCreator(@JsonProperty("id") String id) {
            this.id = id;
        }

        public String getId() {
            return id;
        }
    }

    @Test
    void shouldReadMissingPrimitivesAsDefaults() {
        contextRunner.run(context -> {
            Payload payload = context.getBean(JsonMapper.class).readValue("{\"id\":\"p-1\"}", Payload.class);

            assertThat(payload).isEqualTo(new Payload("p-1", false, 0));
        });
    }

    @Test
    void shouldReadNullPrimitivesAsDefaults() {
        contextRunner.run(context -> {
            Payload payload = context.getBean(JsonMapper.class)
                    .readValue("{\"id\":\"p-1\",\"verified\":null,\"count\":null}", Payload.class);

            assertThat(payload).isEqualTo(new Payload("p-1", false, 0));
        });
    }

    @Test
    void shouldLetAnExplicitPropertyRestoreTheStrictPrimitives() {
        contextRunner
                .withPropertyValues("spring.jackson.deserialization.fail-on-null-for-primitives=true")
                // An explicit null fails on every Jackson 3 line (3.2 already reads a missing primitive as its default)
                .run(context -> assertThatThrownBy(() -> context.getBean(JsonMapper.class)
                        .readValue("{\"id\":\"p-1\",\"verified\":null}", Payload.class))
                        .isInstanceOf(MismatchedInputException.class));
    }

    @Test
    void shouldReadAClassWithANoArgsConstructorThroughItKeepingFieldDefaults() {
        contextRunner.run(context -> {
            WithDefaults value = context.getBean(JsonMapper.class).readValue("{\"id\":\"w-1\"}", WithDefaults.class);

            assertThat(value).isEqualTo(new WithDefaults("w-1", "GUIDE", false));
        });
    }

    @Test
    void shouldStillReadAClassThatOnlyHasAConstructorWithArguments() {
        contextRunner.run(context -> {
            OnlyArgsConstructor value = context.getBean(JsonMapper.class)
                    .readValue("{\"id\":\"o-1\",\"count\":2}", OnlyArgsConstructor.class);

            assertThat(value.getId()).isEqualTo("o-1");
            assertThat(value.getCount()).isEqualTo(2);
        });
    }

    @Test
    void shouldKeepAnExplicitCreatorOverTheNoArgsConstructor() {
        contextRunner.run(context -> {
            ExplicitCreator value = context.getBean(JsonMapper.class).readValue("{\"id\":\"e-1\"}", ExplicitCreator.class);

            assertThat(value.getId()).isEqualTo("e-1");
        });
    }

    public static class DeclarationOrder {
        public String windowsUpdateHistory = "table";
        public String resultCode = "code";
        public String another = "x";
    }

    @Test
    void shouldWritePropertiesInDeclarationOrder() {
        contextRunner.run(context -> assertThat(context.getBean(JsonMapper.class).writeValueAsString(new DeclarationOrder()))
                .isEqualTo("{\"windowsUpdateHistory\":\"table\",\"resultCode\":\"code\",\"another\":\"x\"}"));
    }

    @lombok.Data
    @lombok.Builder
    static class BuilderOnly {
        private String id;
        @lombok.Builder.Default
        private int count = 1;
    }

    @Test
    void shouldBindThroughThePackagePrivateConstructorLombokBuilderGenerates() {
        contextRunner.run(context -> assertThat(context.getBean(JsonMapper.class)
                .readValue("{\"id\":\"b-1\",\"count\":3}", BuilderOnly.class))
                .isEqualTo(BuilderOnly.builder().id("b-1").count(3).build()));
    }

    @Test
    void shouldApplyTheSameSettingsToAHandBuiltMapper() throws Exception {
        WithDefaults value = Jackson2Compatibility.jsonMapper().readValue("{\"id\":\"w-1\",\"verified\":null}", WithDefaults.class);

        assertThat(value).isEqualTo(new WithDefaults("w-1", "GUIDE", false));
    }
}
