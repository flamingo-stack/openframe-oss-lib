package com.openframe.data.integration;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Run with: {@code mvn test -Dintegration.tests=true -pl openframe-data-mongo-sync}.
 *
 * <p>Tests are inert by default: the JUnit {@link EnabledIfSystemProperty} condition
 * runs before any container lifecycle, so CI (which never sets the flag) skips them
 * without touching Docker. {@link Testcontainers#disabledWithoutDocker()} adds a
 * second safety net for developers who set the flag on a Docker-less machine.
 */
public abstract class BaseMongoIntegrationTest {

    protected static final MongoDBContainer MONGO =
            new MongoDBContainer(DockerImageName.parse("mongo:7"));

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        if (!MONGO.isRunning()) {
            MONGO.start();
        }
        registry.add("spring.data.mongodb.uri",
                () -> MONGO.getConnectionString() + "/test?directConnection=true");
        registry.add("spring.data.mongodb.auto-index-creation", () -> "true");
    }
}
