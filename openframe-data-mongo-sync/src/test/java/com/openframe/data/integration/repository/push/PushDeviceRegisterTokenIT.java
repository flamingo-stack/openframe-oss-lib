package com.openframe.data.integration.repository.push;

import com.openframe.data.document.push.PushDevice;
import com.openframe.data.document.push.PushPlatform;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.PushIntegrationTestApplication;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.push.impl.CustomPushDeviceRepositoryImpl;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.convert.MappingMongoConverter;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The registerToken race-handling only means anything against a real unique index — a mocked
 * MongoTemplate cannot enforce {tenantId, token} uniqueness, so these run on real Mongo.
 * Gated like every IT here: -Dintegration.tests=true (Docker required).
 */
@SpringBootTest(classes = PushIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class PushDeviceRegisterTokenIT extends BaseMongoIntegrationTest {

    private static final String TENANT_A = "tenant-a";
    private static final String TENANT_B = "tenant-b";
    private static final String TOKEN = "tok-1";

    @Autowired private MongoDatabaseFactory factory;
    @Autowired private MappingMongoConverter converter;
    @Autowired private MongoTemplate plain;

    private CustomPushDeviceRepositoryImpl repository;

    @BeforeEach
    void setUp() {
        repository = repositoryFor(TENANT_A);

        // remove(), NOT dropCollection() — dropping would take the unique index with it.
        plain.remove(new Query(), PushDevice.class);

        IndexOperations indexOps = plain.indexOps(PushDevice.class);
        new MongoPersistentEntityIndexResolver(plain.getConverter().getMappingContext())
                .resolveIndexFor(PushDevice.class)
                .forEach(indexOps::ensureIndex);
    }

    @Test
    @DisplayName("registerToken creates the row once, then re-binds the same token to a new user — a phone handed to another user must stop receiving the previous user's pushes")
    void creates_then_reassociates_the_token_to_a_new_user() {
        assertThat(repository.registerToken("alice", TOKEN, PushPlatform.ANDROID)).isTrue();
        assertThat(repository.registerToken("bob", TOKEN, PushPlatform.ANDROID)).isFalse();

        List<PushDevice> rows = plain.find(new Query(Criteria.where("token").is(TOKEN)), PushDevice.class);
        assertThat(rows).singleElement().satisfies(d -> {
            assertThat(d.getTenantId()).isEqualTo(TENANT_A);
            assertThat(d.getUserId()).isEqualTo("bob");
        });
    }

    @Test
    @DisplayName("Given 16 threads registering the same token at once, when they race on the unique index, then exactly one row exists and exactly one caller is told it created it — no exception escapes")
    void concurrent_registrations_of_the_same_token_yield_one_row_and_one_creator() throws Exception {
        int threads = 16;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch go = new CountDownLatch(1);

        List<Future<Boolean>> futures = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            String user = "user-" + i;
            futures.add(pool.submit(() -> {
                ready.countDown();
                go.await();
                return repository.registerToken(user, TOKEN, PushPlatform.IOS);
            }));
        }
        ready.await(5, TimeUnit.SECONDS);
        go.countDown();

        int created = 0;
        for (Future<Boolean> f : futures) {
            if (f.get(30, TimeUnit.SECONDS)) {
                created++;
            }
        }
        pool.shutdown();

        long rows = plain.count(new Query(Criteria.where("token").is(TOKEN)), PushDevice.class);
        assertThat(rows).isEqualTo(1);
        assertThat(created).isEqualTo(1);
    }

    @Test
    @DisplayName("Given the same token registered under two tenants, when both are stored, then two rows coexist — the {tenantId, token} unique index is per-tenant, so one physical device never crosses tenants")
    void same_token_coexists_across_tenants() {
        repository.registerToken("alice", TOKEN, PushPlatform.IOS);
        repositoryFor(TENANT_B).registerToken("bob", TOKEN, PushPlatform.IOS);

        List<PushDevice> rows = plain.find(new Query(Criteria.where("token").is(TOKEN)), PushDevice.class);
        assertThat(rows).hasSize(2);
        assertThat(rows).extracting(PushDevice::getTenantId).containsExactlyInAnyOrder(TENANT_A, TENANT_B);
    }

    private CustomPushDeviceRepositoryImpl repositoryFor(String tenantId) {
        TenantIdProvider provider = () -> tenantId;
        return new CustomPushDeviceRepositoryImpl(new TenantAwareMongoTemplate(factory, converter, provider));
    }
}
