package com.openframe.client.integration.osupdate;

import io.nats.client.Connection;
import io.nats.client.JetStreamManagement;
import io.nats.client.Nats;
import io.nats.client.api.RetentionPolicy;
import io.nats.client.api.StorageType;
import io.nats.client.api.StreamConfiguration;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.util.ClassUtils;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;

abstract class BaseOsReportIngestIT {

    static final String OS_UPDATES_STREAM = "MACHINE_OS_UPDATES";
    static final String OS_UPDATES_SUBJECTS = "machine.*.os-updates";
    static final String PACKAGE_MANAGERS_STREAM = "MACHINE_PACKAGE_MANAGERS";
    static final String PACKAGE_MANAGERS_SUBJECTS = "machine.*.package-managers";

    static final GenericContainer<?> NATS =
            new GenericContainer<>(DockerImageName.parse("nats:2.10-alpine"))
                    .withExposedPorts(4222)
                    .withCommand("-js")
                    .waitingFor(Wait.forLogMessage(".*Server is ready.*", 1));

    static final MongoDBContainer MONGO = new MongoDBContainer(DockerImageName.parse("mongo:7"));

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) throws Exception {
        if (!NATS.isRunning()) {
            NATS.start();
        }
        if (!MONGO.isRunning()) {
            MONGO.start();
        }
        String natsUrl = "nats://" + NATS.getHost() + ":" + NATS.getMappedPort(4222);
        createStreams(natsUrl);
        registry.add("nats.spring.server", () -> natsUrl);
        registry.add("spring.mongodb.uri", () -> MONGO.getConnectionString() + "/test?directConnection=true");
        registry.add("spring.data.mongodb.auto-index-creation", () -> "true");
        // read by the mocked bootstrap service of the package-managers pair
        registry.add("openframe.rmm.package-manager-bootstrap.cooldown-seconds", () -> "60");
    }

    // by class, not by bean name: an imported bean and a scanned one are named differently
    static List<String> beanClassNames(ApplicationContext context) {
        return Arrays.stream(context.getBeanDefinitionNames())
                .map(context::getType)
                .filter(Objects::nonNull)
                .map(ClassUtils::getUserClass)
                .map(Class::getSimpleName)
                .toList();
    }

    private static void createStreams(String natsUrl) throws Exception {
        try (Connection connection = Nats.connect(natsUrl)) {
            addStreams(connection.jetStreamManagement());
        }
    }

    private static void addStreams(JetStreamManagement streams) throws Exception {
        streams.addStream(stream(OS_UPDATES_STREAM, OS_UPDATES_SUBJECTS));
        streams.addStream(stream(PACKAGE_MANAGERS_STREAM, PACKAGE_MANAGERS_SUBJECTS));
    }

    private static StreamConfiguration stream(String name, String subjects) {
        return StreamConfiguration.builder()
                .name(name)
                .subjects(List.of(subjects))
                .storageType(StorageType.File)
                .retentionPolicy(RetentionPolicy.Limits)
                .maxAge(Duration.ofHours(1))
                .build();
    }
}
