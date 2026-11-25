package com.openframe.client.integration.osupdate;

import com.openframe.client.integration.support.OsUpdateEnrichmentTestApplication;
import com.openframe.client.scheduler.OsUpdateEnrichmentScheduler;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateSeverity;
import com.openframe.data.repository.rmm.osupdate.OsUpdateRepository;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import io.micrometer.core.instrument.MeterRegistry;
import org.bson.Document;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static com.openframe.client.integration.support.OsUpdateEnrichmentTestApplication.TENANT_ID;
import static org.assertj.core.api.Assertions.assertThat;

// The scheduled run against a real Mongo, with MSRC and CISA answering from checked-in trimmed documents.
@SpringBootTest(
        classes = OsUpdateEnrichmentTestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
                "openframe.rmm.os-update.enabled=true",
                "openframe.rmm.os-update.enrichment.enabled=true",
                "openframe.rmm.os-update.enrichment.msrc.cache-ttl=0s",
                "openframe.rmm.os-update.enrichment.kev.cache-ttl=0s",
                "openframe.rmm.os-update.enrichment.msrc.timeout=5s",
                "openframe.rmm.os-update.enrichment.kev.path=/kev.json",
                "openframe.rmm.os-update.enrichment.cron=-"
        })
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
@DirtiesContext
class OsUpdateEnrichmentIT {

    private static final MongoDBContainer MONGO = new MongoDBContainer(DockerImageName.parse("mongo:7"));
    private static final Map<String, Integer> FAILING_PATHS = new ConcurrentHashMap<>();
    private static final Map<String, AtomicInteger> REQUESTS = new ConcurrentHashMap<>();
    private static final AtomicReference<Runnable> BEFORE_KEV_ANSWER = new AtomicReference<>();
    private static HttpServer sources;

    @Autowired private OsUpdateEnrichmentScheduler osUpdateEnrichmentScheduler;
    @Autowired private OsUpdateRepository osUpdateRepository;
    @Autowired private MeterRegistry meterRegistry;
    @Autowired private MongoTemplate mongoTemplate;

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) throws IOException {
        if (!MONGO.isRunning()) {
            MONGO.start();
        }
        if (sources == null) {
            sources = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            sources.createContext("/", OsUpdateEnrichmentIT::answer);
            sources.start();
        }
        String baseUrl = "http://127.0.0.1:" + sources.getAddress().getPort();
        registry.add("spring.mongodb.uri", () -> MONGO.getConnectionString() + "/test?directConnection=true");
        registry.add("spring.data.mongodb.auto-index-creation", () -> "true");
        registry.add("openframe.rmm.os-update.enrichment.msrc.base-url", () -> baseUrl);
        registry.add("openframe.rmm.os-update.enrichment.kev.base-url", () -> baseUrl);
    }

    @AfterAll
    static void stopSources() {
        if (sources != null) {
            sources.stop(0);
        }
    }

    @BeforeEach
    void setUp() {
        osUpdateRepository.deleteAll();
        FAILING_PATHS.clear();
        REQUESTS.clear();
        meterRegistry.clear();
        BEFORE_KEV_ANSWER.set(null);
    }

    @Test
    void run_newCatalogueEntries_securityUpdatesEnrichedOthersOnlyChecked() {
        // setup
        OsUpdate november = osUpdateRepository.save(windows("nov", "2026-11 Cumulative Update for Windows 11 (KB5132061)", "5132061"));
        OsUpdate october = osUpdateRepository.save(windows("oct", "2026-10 Cumulative Update for Windows 11 (KB5126868)", "5126868"));
        OsUpdate preview = osUpdateRepository.save(windows("prev", "2026-11 Cumulative Update Preview for Windows 11 (KB5132057)", "5132057"));
        OsUpdate mac = osUpdateRepository.save(OsUpdate.builder().tenantId(TENANT_ID).platform(OsPlatform.MACOS)
                .identifier("macOS Tahoe 26.2").displayName("macOS Tahoe 26.2").firstSeenAt(Instant.now()).build());

        // execution
        osUpdateEnrichmentScheduler.run();

        // verifications
        OsUpdate storedNovember = stored(november);
        assertThat(storedNovember.getCveIds()).containsExactly("CVE-2026-113766", "CVE-2026-96157");
        assertThat(storedNovember.getCvssScore()).isEqualTo(9.8);
        assertThat(storedNovember.getSeverity()).isEqualTo(OsUpdateSeverity.IMPORTANT);
        assertThat(storedNovember.getExploited()).isFalse();
        assertThat(storedNovember.getEnrichedAt()).isNotNull();
        OsUpdate storedOctober = stored(october);
        assertThat(storedOctober.getExploited()).isTrue();
        assertThat(storedOctober.getCvssScore()).isEqualTo(8.8);
        OsUpdate storedPreview = stored(preview);
        assertThat(storedPreview.getEnrichedAt()).isNotNull();
        assertThat(storedPreview.getCvssScore()).isNull();
        assertThat(storedPreview.getCveIds()).isEmpty();
        assertThat(stored(mac).getEnrichedAt()).isNotNull();
        assertThat(entries("WINDOWS", "enriched")).isEqualTo(2);
        assertThat(entries("WINDOWS", "no_data")).isEqualTo(1);
        assertThat(meterRegistry.get("openframe.rmm.os_update.enrichment.duration").timer().count()).isEqualTo(1);
    }

    @Test
    void run_laterBulletinOfTheRunSupersedesTheKb_supersededByStored() {
        // setup
        OsUpdate november = osUpdateRepository.save(windows("nov", "2026-11 Cumulative Update for Windows 11 (KB5132061)", "5132061"));
        OsUpdate october = osUpdateRepository.save(windows("oct", "2026-10 Cumulative Update for Windows 11 (KB5127648)", "KB5127648"));

        // execution
        osUpdateEnrichmentScheduler.run();

        // verifications
        assertThat(stored(october).getSupersededBy()).containsExactly("5132061");
        assertThat(stored(november).getSupersededBy()).isNull();
    }

    @Test
    void run_msrcDownThenBack_entriesWaitThenEnrichedOnTheNextRun() {
        // setup
        OsUpdate november = osUpdateRepository.save(windows("nov", "2026-11 Cumulative Update for Windows 11 (KB5132061)", "5132061"));
        OsUpdate october = osUpdateRepository.save(windows("oct", "2026-10 Cumulative Update for Windows 11 (KB5126868)", "5126868"));
        FAILING_PATHS.put("/cvrf/2026-Nov", 503);

        // execution
        osUpdateEnrichmentScheduler.run();

        // verifications
        assertThat(stored(november).getEnrichedAt()).isNull();
        assertThat(stored(october).getEnrichedAt()).isNotNull();
        assertThat(meterRegistry.get("openframe.rmm.os_update.enrichment.source_failed")
                .tag("source", "msrc_cvrf").counter().count()).isPositive();

        // execution
        FAILING_PATHS.clear();
        osUpdateEnrichmentScheduler.run();

        // verifications
        assertThat(stored(november).getCvssScore()).isEqualTo(9.8);
        assertThat(REQUESTS.get("/cvrf/2026-Oct").get()).as("October was fresh, not asked again").isEqualTo(1);
    }

    @Test
    void run_entryStoredBeforeItHadAVersion_enrichedInPlace() {
        // setup
        mongoTemplate.getCollection("os_updates").insertOne(new Document("tenantId", TENANT_ID)
                .append("platform", "WINDOWS")
                .append("identifier", "legacy")
                .append("displayName", "2026-11 Cumulative Update for Windows 11 (KB5132061)")
                .append("kbArticleIds", List.of("5132061"))
                .append("cveIds", List.of()));

        // execution
        osUpdateEnrichmentScheduler.run();

        // verifications
        List<OsUpdate> stored = osUpdateRepository.findAll();
        assertThat(stored).singleElement().satisfies(osUpdate -> {
            assertThat(osUpdate.getCvssScore()).isEqualTo(9.8);
            assertThat(osUpdate.getVersion()).isNotNull();
        });
    }

    @Test
    void run_entryChangedByIngestMeanwhile_skippedAndPickedUpNextRun() {
        // setup
        OsUpdate november = osUpdateRepository.save(windows("nov", "2026-11 Cumulative Update for Windows 11 (KB5132061)", "5132061"));
        OsUpdate october = osUpdateRepository.save(windows("oct", "2026-10 Cumulative Update for Windows 11 (KB5126868)", "5126868"));
        BEFORE_KEV_ANSWER.set(() -> {
            OsUpdate changedByIngest = osUpdateRepository.findById(november.getId()).orElseThrow();
            changedByIngest.setBrowseOnly(true);
            osUpdateRepository.save(changedByIngest);
        });

        // execution
        osUpdateEnrichmentScheduler.run();

        // verifications
        assertThat(stored(november).getEnrichedAt()).isNull();
        assertThat(stored(november).getBrowseOnly()).isTrue();
        assertThat(stored(october).getEnrichedAt()).isNotNull();

        // execution
        osUpdateEnrichmentScheduler.run();

        // verifications
        assertThat(stored(november).getCvssScore()).isEqualTo(9.8);
        assertThat(stored(november).getBrowseOnly()).isTrue();
    }

    @Test
    void run_kevDownAfterItFlaggedTheUpdate_staysExploited() {
        // setup
        OsUpdate outlook = windows("outlook", "2026-11 Security Update for Outlook (KB5132099)", "5132099");
        outlook.setCveIds(List.of("CVE-2026-124194"));
        outlook = osUpdateRepository.save(outlook);
        osUpdateEnrichmentScheduler.run();
        assertThat(stored(outlook).getExploited()).isTrue();
        OsUpdate expired = stored(outlook);
        expired.setEnrichedAt(Instant.now().minus(2, ChronoUnit.DAYS));
        osUpdateRepository.save(expired);
        FAILING_PATHS.put("/kev.json", 503);

        // execution
        osUpdateEnrichmentScheduler.run();

        // verifications
        assertThat(stored(outlook).getExploited()).isTrue();
        assertThat(stored(outlook).getEnrichedAt()).isAfter(Instant.now().minus(1, ChronoUnit.HOURS));
    }

    @Test
    void run_monthThatKeepsFailingAndBatchOfOne_healthyEntryStillEnriched() {
        // setup
        osUpdateRepository.save(windows("nov-1", "2026-11 Cumulative Update for Windows 11 (KB5132061)", "5132061"));
        osUpdateRepository.save(windows("nov-2", "2026-11 Cumulative Update for Windows 10 (KB5132061)", "5132061"));
        OsUpdate october = osUpdateRepository.save(windows("oct", "2026-10 Cumulative Update for Windows 11 (KB5126868)", "5126868"));
        FAILING_PATHS.put("/cvrf/2026-Nov", 503);
        ReflectionTestUtils.setField(osUpdateEnrichmentScheduler, "batchSize", 1);

        // execution
        try {
            for (int run = 0; run < 3; run++) {
                osUpdateEnrichmentScheduler.run();
            }
        } finally {
            ReflectionTestUtils.setField(osUpdateEnrichmentScheduler, "batchSize", 500);
        }

        // verifications
        assertThat(stored(october).getCvssScore()).isEqualTo(8.8);
    }

    @Test
    void run_enrichedWithinTheTtl_notAskedAgain() {
        // setup
        OsUpdate november = windows("nov", "2026-11 Cumulative Update for Windows 11 (KB5132061)", "5132061");
        november.setEnrichedAt(Instant.now().minus(1, ChronoUnit.HOURS));
        osUpdateRepository.save(november);

        // execution
        osUpdateEnrichmentScheduler.run();

        // verifications
        assertThat(REQUESTS).isEmpty();
    }

    @Test
    void run_kevTruncated_enrichedFromMsrcOnly() {
        // setup
        OsUpdate november = osUpdateRepository.save(windows("nov", "2026-11 Cumulative Update for Windows 11 (KB5132061)", "5132061"));
        FAILING_PATHS.put("/kev.json", 0);

        // execution
        osUpdateEnrichmentScheduler.run();

        // verifications
        OsUpdate storedNovember = stored(november);
        assertThat(storedNovember.getCvssScore()).isEqualTo(9.8);
        assertThat(storedNovember.getCveIds()).containsExactly("CVE-2026-113766", "CVE-2026-96157");
        assertThat(storedNovember.getExploited()).isFalse();
        assertThat(storedNovember.getEnrichedAt()).isNotNull();
        assertThat(meterRegistry.get("openframe.rmm.os_update.enrichment.source_failed")
                .tag("source", "cisa_kev").counter().count()).isPositive();
    }

    private OsUpdate stored(OsUpdate osUpdate) {
        return osUpdateRepository.findById(osUpdate.getId()).orElseThrow();
    }

    private double entries(String platform, String result) {
        return meterRegistry.get("openframe.rmm.os_update.enrichment.entries")
                .tags("platform", platform, "result", result).counter().count();
    }

    private static OsUpdate windows(String identifier, String displayName, String kbArticleId) {
        return OsUpdate.builder()
                .tenantId(TENANT_ID)
                .platform(OsPlatform.WINDOWS)
                .identifier(identifier)
                .displayName(displayName)
                .kbArticleIds(List.of(kbArticleId))
                .cveIds(List.of())
                .firstSeenAt(Instant.now())
                .build();
    }

    // Status 0 = a body cut in the middle.
    private static void answer(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        REQUESTS.computeIfAbsent(path, key -> new AtomicInteger()).incrementAndGet();
        Runnable beforeKevAnswer = BEFORE_KEV_ANSWER.getAndSet(null);
        if (beforeKevAnswer != null && path.equals("/kev.json")) {
            beforeKevAnswer.run();
        }
        String fixture = switch (path) {
            case "/cvrf/2026-Nov" -> "msrc-cvrf-2026-Nov.json";
            case "/cvrf/2026-Oct" -> "msrc-cvrf-2026-Oct.json";
            case "/kev.json" -> "cisa-kev.json";
            default -> null;
        };
        Integer failure = FAILING_PATHS.get(path);
        try (exchange) {
            if (fixture == null || (failure != null && failure > 0)) {
                exchange.sendResponseHeaders(fixture == null ? 404 : failure, -1);
                return;
            }
            byte[] body;
            try (InputStream document = OsUpdateEnrichmentIT.class.getResourceAsStream("/osupdate/enrichment/" + fixture)) {
                body = document.readAllBytes();
            }
            if (failure != null) {
                body = Arrays.copyOf(body, body.length / 2);
            }
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(body);
            }
        }
    }
}
