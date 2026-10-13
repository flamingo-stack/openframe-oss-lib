package com.openframe.kafka.config;

import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.kafka.autoconfigure.KafkaProperties;
import org.springframework.core.env.Environment;
import org.springframework.kafka.core.KafkaAdmin;

/**
 * Applies the standard {@code spring.kafka.admin.*} settings to a {@link KafkaAdmin} built by hand, as Boot does for
 * its own: with {@code auto-create: false} no topic is created while the context starts (the AOT cache training run).
 */
public final class KafkaAdminSettings {

    private KafkaAdminSettings() {
    }

    public static KafkaAdmin apply(KafkaAdmin admin, Environment environment) {
        KafkaProperties.Admin settings = Binder.get(environment)
                .bind("spring.kafka.admin", KafkaProperties.Admin.class)
                .orElseGet(() -> new KafkaProperties().getAdmin());
        apply(admin, settings);
        return admin;
    }

    static void apply(KafkaAdmin admin, KafkaProperties.Admin settings) {
        admin.setAutoCreate(settings.isAutoCreate());
        admin.setFatalIfBrokerNotAvailable(settings.isFailFast());
        admin.setModifyTopicConfigs(settings.isModifyTopicConfigs());
        if (settings.getOperationTimeout() != null) {
            admin.setOperationTimeout((int) settings.getOperationTimeout().toSeconds());
        }
        if (settings.getCloseTimeout() != null) {
            admin.setCloseTimeout((int) settings.getCloseTimeout().toSeconds());
        }
    }
}
