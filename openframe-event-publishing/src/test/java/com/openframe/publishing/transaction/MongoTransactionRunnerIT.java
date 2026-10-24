package com.openframe.publishing.transaction;

import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.TransactionManager;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(classes = MongoTransactionRunnerIT.TestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
@Testcontainers
class MongoTransactionRunnerIT {

    // Transactions need a replica set; the shared BaseMongoIntegrationTest connects to its node directly, as a standalone.
    @Container
    static final MongoDBContainer MONGO = new MongoDBContainer(DockerImageName.parse("mongo:7")).withReplicaSet();

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", MONGO::getReplicaSetUrl);
    }

    private static final String FIRST = "transaction_first";
    private static final String SECOND = "transaction_second";

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private MongoDatabaseFactory mongoDatabaseFactory;

    @Autowired
    private ApplicationContext context;

    private MongoTransactionRunner runner;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(FIRST);
        mongoTemplate.dropCollection(SECOND);
        mongoTemplate.createCollection(FIRST);
        mongoTemplate.createCollection(SECOND);
        runner = new MongoTransactionRunner(mongoDatabaseFactory);
    }

    @Test
    void writesInOneRunCommitTogether() {
        runner.run(() -> {
            mongoTemplate.insert(new Document("_id", "a"), FIRST);
            mongoTemplate.insert(new Document("_id", "b"), SECOND);
            return null;
        });

        assertThat(mongoTemplate.getCollection(FIRST).countDocuments()).isEqualTo(1);
        assertThat(mongoTemplate.getCollection(SECOND).countDocuments()).isEqualTo(1);
    }

    @Test
    void aFailureRollsBackEveryWriteOfTheRun() {
        assertThatThrownBy(() -> runner.run(() -> {
            mongoTemplate.insert(new Document("_id", "a"), FIRST);
            throw new IllegalStateException("second write failed");
        })).isInstanceOf(IllegalStateException.class);

        assertThat(mongoTemplate.getCollection(FIRST).countDocuments()).isZero();
    }

    // The transaction reads, another write commits the same document, then the transaction writes it: WriteConflict (112).
    @Test
    void aRealWriteConflict_reachesTheCallerAsAVersionConflict() {
        mongoTemplate.insert(new Document("_id", "a").append("n", 0), FIRST);
        Criteria idIsA = Criteria.where("_id").is("a");
        Query byId = Query.query(idIsA);
        Update setOne = new Update().set("n", 1);
        Update setTwo = new Update().set("n", 2);

        try (ExecutorService otherWriter = Executors.newSingleThreadExecutor()) {
            assertThatThrownBy(() -> runner.run(() -> {
                mongoTemplate.findOne(byId, Document.class, FIRST);
                otherWriter.submit(() -> mongoTemplate.updateFirst(byId, setOne, FIRST)).get();
                mongoTemplate.updateFirst(byId, setTwo, FIRST);
                return null;
            })).isInstanceOf(OptimisticLockingFailureException.class);
        }

        Document stored = mongoTemplate.findOne(byId, Document.class, FIRST);
        assertThat(stored).containsEntry("n", 1);
    }

    @Test
    void theRunnerRegistersNoTransactionManagerBean() {
        assertThat(context.getBeanNamesForType(TransactionManager.class)).isEmpty();
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    static class TestApplication {
    }
}
