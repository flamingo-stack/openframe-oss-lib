package com.openframe.data.integration;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

public abstract class BaseMongoIntegrationTest {

    private static final String EXTERNAL_URI = System.getProperty("mongo.external.uri");

    protected static final MongoDBContainer MONGO =
            new MongoDBContainer(DockerImageName.parse("mongo:7"));

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.data.mongodb.uri", BaseMongoIntegrationTest::resolveUri);
        registry.add("spring.data.mongodb.auto-index-creation", () -> "true");
    }

    private static String resolveUri() {
        if (EXTERNAL_URI != null) {
            return EXTERNAL_URI;
        }
        if (!MONGO.isRunning()) {
            MONGO.start();
        }
        return MONGO.getConnectionString() + "/test?directConnection=true";
    }
}
