package com.openframe.data.nats.integration;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;

public abstract class BaseIntegrationTest {

    protected static final MongoDBContainer MONGO =
            new MongoDBContainer(DockerImageName.parse("mongo:7"));

    protected static final GenericContainer<?> NATS =
            new GenericContainer<>(DockerImageName.parse("nats:2.10-alpine"))
                    .withExposedPorts(4222)
                    .waitingFor(Wait.forLogMessage(".*Server is ready.*", 1));

    @DynamicPropertySource
    static void infrastructureProperties(DynamicPropertyRegistry registry) {
        if (!MONGO.isRunning()) {
            MONGO.start();
        }
        if (!NATS.isRunning()) {
            NATS.start();
        }
        registry.add("spring.data.mongodb.uri",
                () -> MONGO.getConnectionString() + "/test?directConnection=true");
        registry.add("spring.data.mongodb.auto-index-creation", () -> "true");
    }

    protected static String natsUri() {
        if (!NATS.isRunning()) {
            NATS.start();
        }
        return "nats://" + NATS.getHost() + ":" + NATS.getMappedPort(4222);
    }
}
