package com.openframe.data.config;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import org.bson.Document;
import org.bson.types.Decimal128;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.data.mongodb.autoconfigure.DataMongoReactiveAutoConfiguration;
import org.springframework.boot.mongodb.autoconfigure.MongoReactiveAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.convert.ConversionFailedException;
import org.springframework.data.mongodb.core.ReactiveMongoTemplate;
import org.springframework.data.mongodb.core.convert.MongoConverter;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;

import java.math.BigDecimal;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MongoReactiveConversionsConfigTest {

    private static final String STATUS = "status";
    private static final BigDecimal AMOUNT = new BigDecimal("12.50");

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(MongoReactiveConversionsConfig.class)
            .withConfiguration(AutoConfigurations.of(
                    MongoReactiveAutoConfiguration.class, DataMongoReactiveAutoConfiguration.class));

    @Test
    void mongoCustomConversions_withoutSyncConfig_singleBean() {
        // execution
        contextRunner.run(context -> {

            // verifications
            assertThat(context).hasSingleBean(MongoCustomConversions.class);
        });
    }

    @Test
    void mongoCustomConversions_withoutBootMongoProperties_singleBean() {
        // setup
        ApplicationContextRunner withoutAutoConfiguration = new ApplicationContextRunner()
                .withUserConfiguration(MongoReactiveConversionsConfig.class);

        // execution
        withoutAutoConfiguration.run(context -> {

            // verifications
            assertThat(context).hasSingleBean(MongoCustomConversions.class);
        });
    }

    @ParameterizedTest
    @MethodSource("bigDecimalRepresentations")
    void reactiveTemplateWrite_bigDecimalRepresentationProperty_honoured(String property, Object expected) {
        // setup
        ApplicationContextRunner withProperty = contextRunner
                .withPropertyValues("spring.data.mongodb.representation.big-decimal=" + property);

        // execution
        withProperty.run(context -> {
            MongoConverter converter = context.getBean(ReactiveMongoTemplate.class).getConverter();
            Object written = converter.convertToMongoType(AMOUNT);

            // verifications
            assertThat(written).isEqualTo(expected);
        });
    }

    @Test
    void reactiveTemplateWrite_noBigDecimalProperty_sameAsBootDefault() {
        // setup
        ApplicationContextRunner bootDefault = new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(
                        MongoReactiveAutoConfiguration.class, DataMongoReactiveAutoConfiguration.class));
        AtomicReference<Object> bootWritten = new AtomicReference<>();
        bootDefault.run(context -> bootWritten.set(
                context.getBean(ReactiveMongoTemplate.class).getConverter().convertToMongoType(AMOUNT)));

        // execution
        contextRunner.run(context -> {
            Object written = context.getBean(ReactiveMongoTemplate.class).getConverter().convertToMongoType(AMOUNT);

            // verifications
            assertThat(written).isEqualTo(bootWritten.get());
        });
    }

    @ParameterizedTest
    @MethodSource("storedStatuses")
    void reactiveTemplateRead_storedStatus_mappedStatus(String stored, DeviceStatus expected) {
        // setup
        Document document = new Document(STATUS, stored);

        // execution
        contextRunner.run(context -> {
            MongoConverter converter = context.getBean(ReactiveMongoTemplate.class).getConverter();
            Machine machine = converter.read(Machine.class, document);

            // verifications
            assertThat(machine.getStatus()).isEqualTo(expected);
        });
    }

    @Test
    void reactiveTemplateRead_storedUnknownStatus_throwsConversionFailed() {
        // setup
        Document document = new Document(STATUS, "RETIRED");

        // execution
        contextRunner.run(context -> {
            MongoConverter converter = context.getBean(ReactiveMongoTemplate.class).getConverter();

            // verifications
            assertThatThrownBy(() -> converter.read(Machine.class, document))
                    .isInstanceOf(ConversionFailedException.class)
                    .hasMessageContaining("RETIRED");
        });
    }

    private static Stream<Arguments> bigDecimalRepresentations() {
        return Stream.of(
                Arguments.of("decimal128", new Decimal128(AMOUNT)),
                Arguments.of("string", "12.50"));
    }

    private static Stream<Arguments> storedStatuses() {
        return Stream.of(
                Arguments.of("ONLINE", DeviceStatus.MANAGED),
                Arguments.of("OFFLINE", DeviceStatus.MANAGED),
                Arguments.of("ACTIVE", DeviceStatus.MANAGED),
                Arguments.of("INACTIVE", DeviceStatus.ARCHIVED),
                Arguments.of("MAINTENANCE", DeviceStatus.ARCHIVED),
                Arguments.of("DECOMMISSIONED", DeviceStatus.ARCHIVED),
                Arguments.of("MANAGED", DeviceStatus.MANAGED),
                Arguments.of("PENDING", DeviceStatus.PENDING),
                Arguments.of("PENDING_DELETION", DeviceStatus.PENDING_DELETION),
                Arguments.of("DELETED", DeviceStatus.DELETED),
                Arguments.of("ARCHIVED", DeviceStatus.ARCHIVED));
    }
}
