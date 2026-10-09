package com.openframe.delivery.config;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.config.DeliveryProperties.Policy;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.BindResult;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.bind.validation.BindValidationException;
import org.springframework.boot.context.properties.bind.validation.ValidationBindHandler;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;
import org.springframework.validation.beanvalidation.SpringValidatorAdapter;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// what Spring Boot does at startup: bind openframe.delivery.* and validate every bound object
class DeliveryPropertiesBindingTest {

    private static final String PREFIX = "openframe.delivery";
    private static final long UNINSTALL_WINDOW = 2_592_000L;

    @Test
    void bind_perTypeEntryWithTwoFields_bindsAndTakesTheRestFromDefaults() {
        // setup
        Map<String, String> config = fullDefaults();
        config.put(PREFIX + ".types.CLIENT_UNINSTALL.reconnect-window-seconds", String.valueOf(UNINSTALL_WINDOW));
        config.put(PREFIX + ".types.CLIENT_UNINSTALL.ttl-seconds", String.valueOf(UNINSTALL_WINDOW));

        // execution
        DeliveryProperties properties = bind(config);

        // verifications
        Policy uninstall = properties.resolve(DeliveryType.CLIENT_UNINSTALL);
        assertThat(uninstall.getReconnectWindowSeconds()).isEqualTo(UNINSTALL_WINDOW);
        assertThat(uninstall.getTtlSeconds()).isEqualTo(UNINSTALL_WINDOW);
        assertThat(uninstall.getMaxAttempts()).isEqualTo(3);
        assertThat(uninstall.getResultTimeoutSeconds()).isEqualTo(600L);
    }

    @Test
    void bind_defaultsMissingAField_rejected() {
        // setup
        Map<String, String> config = fullDefaults();
        config.remove(PREFIX + ".defaults.result-timeout-seconds");

        // execution + verifications
        assertThatThrownBy(() -> bind(config)).hasRootCauseInstanceOf(BindValidationException.class);
    }

    private static DeliveryProperties bind(Map<String, String> config) {
        Binder binder = new Binder(new MapConfigurationPropertySource(config));
        SpringValidatorAdapter validator = new SpringValidatorAdapter(Validation.buildDefaultValidatorFactory().getValidator());
        BindResult<DeliveryProperties> bound = binder.bind(PREFIX, Bindable.of(DeliveryProperties.class), new ValidationBindHandler(validator));
        return bound.get();
    }

    private static Map<String, String> fullDefaults() {
        Map<String, String> config = new HashMap<>();
        config.put(PREFIX + ".sweep.interval", "30000");
        config.put(PREFIX + ".sweep.batch-size", "500");
        config.put(PREFIX + ".defaults.ack-threshold-seconds", "30");
        config.put(PREFIX + ".defaults.max-attempts", "3");
        config.put(PREFIX + ".defaults.backoff-multiplier", "2");
        config.put(PREFIX + ".defaults.max-retry-interval-seconds", "300");
        config.put(PREFIX + ".defaults.offline-behavior", "RETRY_ON_RECONNECT");
        config.put(PREFIX + ".defaults.reconnect-window-seconds", "86400");
        config.put(PREFIX + ".defaults.result-timeout-seconds", "600");
        config.put(PREFIX + ".defaults.ttl-seconds", "604800");
        return config;
    }
}
