package com.openframe.kafka.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.kafka.autoconfigure.KafkaProperties;
import org.springframework.kafka.core.KafkaAdmin;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class KafkaAdminSettingsTest {

    @Test
    void apply_fromEnvironment_readsSpringKafkaAdmin() {
        MockEnvironment environment = new MockEnvironment().withProperty("spring.kafka.admin.auto-create", "false");
        KafkaAdmin admin = new KafkaAdmin(Map.of());

        KafkaAdminSettings.apply(admin, environment);

        assertThat(ReflectionTestUtils.getField(admin, "autoCreate")).isEqualTo(false);
    }

    @Test
    void apply_fromEnvironmentWithoutSettings_keepsCreatingTopics() {
        KafkaAdmin admin = new KafkaAdmin(Map.of());

        KafkaAdminSettings.apply(admin, new MockEnvironment());

        assertThat(ReflectionTestUtils.getField(admin, "autoCreate")).isEqualTo(true);
    }

    @Test
    void applyAdminSettings_autoCreateOff_noTopicsCreatedOnStartup() {
        KafkaProperties properties = new KafkaProperties();
        properties.getAdmin().setAutoCreate(false);
        properties.getAdmin().setOperationTimeout(Duration.ofSeconds(5));
        KafkaAdmin admin = new KafkaAdmin(Map.of());

        KafkaAdminSettings.apply(admin, properties.getAdmin());

        assertThat(ReflectionTestUtils.getField(admin, "autoCreate")).isEqualTo(false);
        assertThat(admin.getOperationTimeout()).isEqualTo(5);
    }

    @Test
    void applyAdminSettings_defaults_keepCreatingTopics() {
        KafkaAdmin admin = new KafkaAdmin(Map.of());

        KafkaAdminSettings.apply(admin, new KafkaProperties().getAdmin());

        assertThat(ReflectionTestUtils.getField(admin, "autoCreate")).isEqualTo(true);
        assertThat(ReflectionTestUtils.getField(admin, "fatalIfBrokerNotAvailable")).isEqualTo(false);
    }
}
