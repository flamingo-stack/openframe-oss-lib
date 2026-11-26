package com.openframe.management.integration.osupdate;

import com.openframe.management.integration.support.OsUpdateEnrichmentTestApplication;
import com.openframe.management.osupdate.OsUpdateEnrichmentScheduler;
import com.openframe.management.osupdate.OsUpdateEnrichmentService;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateSeverity;
import com.openframe.data.document.rmm.osupdate.OsVersionBuild;
import com.openframe.data.repository.rmm.osupdate.OsUpdateRepository;
import com.openframe.data.repository.rmm.osupdate.OsVersionBuildRepository;
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
import java.time.Duration;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static com.openframe.management.integration.support.OsUpdateEnrichmentTestApplication.TENANT_ID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

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
    private static final YearMonth NOVEMBER = YearMonth.of(2026, 11);
    private static final Duration REFRESH_INTERVAL = Duration.ofHours(6);
    private static HttpServer sources;

    @Autowired private OsUpdateEnrichmentScheduler osUpdateEnrichmentScheduler;
    @Autowired private OsUpdateEnrichmentService osUpdateEnrichmentService;
    @Autowired private OsUpdateRepository osUpdateRepository;
    @Autowired private OsVersionBuildRepository osVersionBuildRepository;
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
        osVersionBuildRepository.deleteAll();
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
        assertThat(storedNovember.getSeverity()).isEqualTo(OsUpdateSeverity.IMPORTANT);
        assertThat(storedNovember.getExploited()).isFalse();
        assertThat(storedNovember.getEnrichedAt()).isNotNull();
        OsUpdate storedOctober = stored(october);
        assertThat(storedOctober.getExploited()).isTrue();
        assertThat(storedOctober.getCveIds()).containsExactly("CVE-2026-96951");
        OsUpdate storedPreview = stored(preview);
        assertThat(storedPreview.getEnrichedAt()).isNotNull();
        assertThat(storedPreview.getCveIds()).isEmpty();
        assertThat(stored(mac).getEnrichedAt()).isNotNull();
        assertThat(entries("WINDOWS", "enriched")).isEqualTo(2);
        assertThat(entries("WINDOWS", "no_data")).isEqualTo(1);
        assertThat(meterRegistry.get("openframe.rmm.os_update.enrichment.duration").timer().count()).isEqualTo(1);
        assertThat(meterRegistry.get("openframe.rmm.os_update.enrichment.source_fetch")
                .tags("source", "cisa_kev", "result", "success").counter().count()).isPositive();
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
        assertThat(meterRegistry.get("openframe.rmm.os_update.enrichment.source_fetch")
                .tags("source", "msrc_cvrf", "result", "failure").counter().count()).isPositive();

        // execution
        FAILING_PATHS.clear();
        osUpdateEnrichmentScheduler.run();

        // verifications
        assertThat(stored(november).getCveIds()).containsExactly("CVE-2026-113766", "CVE-2026-96157");
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
            assertThat(osUpdate.getCveIds()).containsExactly("CVE-2026-113766", "CVE-2026-96157");
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
        assertThat(stored(november).getCveIds()).containsExactly("CVE-2026-113766", "CVE-2026-96157");
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
    void run_monthThatFailsAndBatchOfOne_healthyEntryAfterItEnrichedInTheSameRun() {
        // setup
        osUpdateRepository.save(windows("nov-1", "2026-11 Cumulative Update for Windows 11 (KB5132061)", "5132061"));
        osUpdateRepository.save(windows("nov-2", "2026-11 Cumulative Update for Windows 10 (KB5132061)", "5132061"));
        OsUpdate october = osUpdateRepository.save(windows("oct", "2026-10 Cumulative Update for Windows 11 (KB5126868)", "5126868"));
        FAILING_PATHS.put("/cvrf/2026-Nov", 503);
        ReflectionTestUtils.setField(osUpdateEnrichmentScheduler, "batchSize", 1);

        // execution
        try {
            osUpdateEnrichmentScheduler.run();
        } finally {
            ReflectionTestUtils.setField(osUpdateEnrichmentScheduler, "batchSize", 500);
        }

        // verifications
        assertThat(stored(october).getCveIds()).containsExactly("CVE-2026-96951");
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
        assertThat(storedNovember.getCveIds()).containsExactly("CVE-2026-113766", "CVE-2026-96157");
        assertThat(storedNovember.getExploited()).isFalse();
        assertThat(storedNovember.getEnrichedAt()).isNotNull();
        assertThat(meterRegistry.get("openframe.rmm.os_update.enrichment.source_fetch")
                .tags("source", "cisa_kev", "result", "failure").counter().count()).isPositive();
    }

    @Test
    void refreshOsVersionBuilds_bulletinsOfTwoMonths_latestBuildPerWindowsVersionStoredAndNotAskedAgainSoon() {
        // setup

        // execution
        osUpdateEnrichmentService.refreshOsVersionBuilds(NOVEMBER, Instant.now().minus(REFRESH_INTERVAL));

        // verifications
        List<OsVersionBuild> storedOsVersionBuilds = osVersionBuildRepository.findAll();
        assertThat(storedOsVersionBuilds)
                .extracting(OsVersionBuild::getTenantId, OsVersionBuild::getPlatform, OsVersionBuild::getOsVersion,
                        OsVersionBuild::getLatestBuild, OsVersionBuild::getHotpatchBuild)
                .containsExactlyInAnyOrder(
                        tuple(TENANT_ID, OsPlatform.WINDOWS, "11 24H2", "26100.9974", "26100.9911"),
                        tuple(TENANT_ID, OsPlatform.WINDOWS, "11 25H2", "26200.9974", "26200.9911"),
                        tuple(TENANT_ID, OsPlatform.WINDOWS, "10 1607", "14393.9612", null));
        assertThat(storedOsVersionBuilds).allSatisfy(osVersionBuild -> {
            assertThat(osVersionBuild.getUpdatedAt()).isNotNull();
            assertThat(osVersionBuild.getVersion()).isNotNull();
        });
        assertThat(REQUESTS).containsOnlyKeys("/cvrf/2026-Nov", "/cvrf/2026-Oct");

        // execution
        REQUESTS.clear();
        osUpdateEnrichmentService.refreshOsVersionBuilds(NOVEMBER, Instant.now().minus(REFRESH_INTERVAL));

        // verifications
        assertThat(REQUESTS).isEmpty();
        assertThat(osVersionBuildRepository.count()).isEqualTo(3);
    }

    @Test
    void refreshOsVersionBuilds_currentMonthNotPublishedYet_buildsOfThePreviousMonthAndNoSourceFailure() {
        // setup

        // execution
        osUpdateEnrichmentService.refreshOsVersionBuilds(NOVEMBER.plusMonths(1), Instant.now().minus(REFRESH_INTERVAL));

        // verifications
        assertThat(osVersionBuildRepository.findAll())
                .extracting(OsVersionBuild::getOsVersion, OsVersionBuild::getLatestBuild)
                .containsExactlyInAnyOrder(tuple("11 24H2", "26100.9974"), tuple("11 25H2", "26200.9974"));
        assertThat(REQUESTS).containsOnlyKeys("/cvrf/2026-Dec", "/cvrf/2026-Nov");
        assertThat(meterRegistry.find("openframe.rmm.os_update.enrichment.source_fetch")
                .tags("source", "msrc_cvrf", "result", "failure").counter()).isNull();
    }

    @Test
    void refreshOsVersionBuilds_msrcDownThenBack_storedBuildsKeptThenRaisedWithTheirHotpatchButNeverLowered() {
        // setup
        Instant refreshedYesterday = Instant.now().minus(1, ChronoUnit.DAYS).truncatedTo(ChronoUnit.MILLIS);
        osVersionBuildRepository.save(osVersionBuild("11 24H2", "26100.9711", null, refreshedYesterday));
        osVersionBuildRepository.save(osVersionBuild("11 25H2", "26200.10075", "26200.10001", refreshedYesterday));
        osVersionBuildRepository.save(osVersionBuild("10 1607", "14393.9512", "14393.9400", refreshedYesterday));
        FAILING_PATHS.put("/cvrf/2026-Oct", 503);

        // execution
        osUpdateEnrichmentService.refreshOsVersionBuilds(NOVEMBER, Instant.now().minus(REFRESH_INTERVAL));

        // verifications
        assertThat(osVersionBuildRepository.findAll())
                .extracting(OsVersionBuild::getOsVersion, OsVersionBuild::getLatestBuild,
                        OsVersionBuild::getHotpatchBuild, OsVersionBuild::getUpdatedAt)
                .containsExactlyInAnyOrder(tuple("11 24H2", "26100.9711", null, refreshedYesterday),
                        tuple("11 25H2", "26200.10075", "26200.10001", refreshedYesterday),
                        tuple("10 1607", "14393.9512", "14393.9400", refreshedYesterday));
        assertThat(meterRegistry.get("openframe.rmm.os_update.enrichment.source_fetch")
                .tags("source", "msrc_cvrf", "result", "failure").counter().count()).isEqualTo(1);

        // execution
        FAILING_PATHS.clear();
        osUpdateEnrichmentService.refreshOsVersionBuilds(NOVEMBER, Instant.now().minus(REFRESH_INTERVAL));

        // verifications
        assertThat(osVersionBuildRepository.findAll())
                .extracting(OsVersionBuild::getOsVersion, OsVersionBuild::getLatestBuild,
                        OsVersionBuild::getHotpatchBuild)
                .containsExactlyInAnyOrder(tuple("11 24H2", "26100.9974", "26100.9911"),
                        tuple("11 25H2", "26200.10075", "26200.10001"),
                        tuple("10 1607", "14393.9612", null));
        assertThat(osVersionBuildRepository.findAll())
                .allSatisfy(osVersionBuild -> assertThat(osVersionBuild.getUpdatedAt()).isAfter(refreshedYesterday));
    }

    @Test
    void refreshOsVersionBuilds_truncatedBulletin_nothingStored() {
        // setup
        FAILING_PATHS.put("/cvrf/2026-Nov", 0);

        // execution
        osUpdateEnrichmentService.refreshOsVersionBuilds(NOVEMBER, Instant.now().minus(REFRESH_INTERVAL));

        // verifications
        assertThat(osVersionBuildRepository.count()).isZero();
    }

    @Test
    void refreshOsVersionBuilds_scheduledRun_asksTheBulletinsOfThisAndThePreviousMonth() {
        // setup
        YearMonth currentMonth = YearMonth.now(ZoneOffset.UTC);

        // execution
        osUpdateEnrichmentScheduler.refreshOsVersionBuilds();

        // verifications
        assertThat(REQUESTS).containsOnlyKeys(cvrfPath(currentMonth), cvrfPath(currentMonth.minusMonths(1)));
        assertThat(meterRegistry.find("openframe.rmm.os_update.enrichment.errors").counter()).isNull();
    }

    private static String cvrfPath(YearMonth month) {
        return "/cvrf/" + DateTimeFormatter.ofPattern("yyyy-MMM", Locale.ENGLISH).format(month);
    }

    private static OsVersionBuild osVersionBuild(String osVersion, String latestBuild, String hotpatchBuild,
                                                 Instant updatedAt) {
        return OsVersionBuild.builder()
                .tenantId(TENANT_ID)
                .platform(OsPlatform.WINDOWS)
                .osVersion(osVersion)
                .latestBuild(latestBuild)
                .hotpatchBuild(hotpatchBuild)
                .updatedAt(updatedAt)
                .build();
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
