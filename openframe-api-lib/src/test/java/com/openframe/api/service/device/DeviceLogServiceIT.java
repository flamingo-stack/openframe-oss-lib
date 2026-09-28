package com.openframe.api.service.device;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.device.DeviceLogEntry;
import com.openframe.api.dto.device.DeviceLogFilterCriteria;
import com.openframe.api.dto.device.DeviceLogLevel;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.loki.client.LokiClient;
import com.openframe.data.loki.model.LokiDirection;
import com.openframe.data.repository.tenant.TenantRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * {@link DeviceLogService} with its real {@link LokiClient} against a real Loki, seeded the way
 * {@code openframe-saas-logs-stream} writes agent logs: {@code job}, {@code tenant_domain} and {@code level} stream
 * labels, with {@code machine_id}, {@code hostname}, {@code agent_ts} and {@code count} as structured metadata.
 * Only the Mongo lookups (device, tenant) are stubbed.
 */
class DeviceLogServiceIT {

    private static final GenericContainer<?> LOKI = new GenericContainer<>(DockerImageName.parse("grafana/loki:3.7.3"))
            .withExposedPorts(3100)
            .waitingFor(Wait.forHttp("/ready").forPort(3100).forStatusCode(200)
                    .withStartupTimeout(Duration.ofMinutes(2)));

    private static final String TENANT_ID = "tenant-a";
    private static final String TENANT_DOMAIN = "acme.openframe.test";
    private static final String OTHER_TENANT_DOMAIN = "globex.openframe.test";
    private static final String MACHINE_ID = "machine-a";
    private static final String OTHER_MACHINE_ID = "machine-b";
    private static final String POLL_MACHINE_ID = "machine-poll";

    private static final int DEVICE_LINES = 600;
    private static final int ERROR_LINES = 12;
    private static final int TIED_LINES = 5;
    private static final int TIED_ERROR_LINES = 2;
    private static final long STEP_NANOS = 100_000_000L;
    private static final Instant BASE = Instant.now().minus(Duration.ofHours(1)).truncatedTo(ChronoUnit.MILLIS);
    private static final long BASE_NANOS = toNanos(BASE);
    // Five lines share this nanosecond, between line 300 and line 301, split across the INFO and ERROR streams
    private static final long TIED_NANOS = BASE_NANOS + 300 * STEP_NANOS + 50;
    private static final Instant FROM = BASE.minus(Duration.ofMinutes(1));

    private static final ObjectMapper JSON = new ObjectMapper();

    private static LokiClient lokiClient;
    private static DeviceLogService service;

    @BeforeAll
    static void startLokiAndSeedLogs() throws Exception {
        LOKI.start();
        lokiClient = new LokiClient(RestClient.builder().baseUrl(baseUrl()).build());
        service = newService();

        Map<String, List<List<Object>>> deviceLinesByLevel = new LinkedHashMap<>();
        for (int i = 0; i < DEVICE_LINES; i++) {
            String level = i % 50 == 0 ? "ERROR" : i % 20 == 0 ? "WARN" : "INFO";
            String message = String.format("line-%03d %s", i, "ERROR".equals(level) ? "Connection FAILED" : "heartbeat ok");
            deviceLinesByLevel.computeIfAbsent(level, key -> new ArrayList<>())
                    .add(entry(BASE_NANOS + i * STEP_NANOS, message, MACHINE_ID));
        }
        for (int i = 0; i < TIED_LINES; i++) {
            String level = i < TIED_LINES - TIED_ERROR_LINES ? "INFO" : "ERROR";
            deviceLinesByLevel.computeIfAbsent(level, key -> new ArrayList<>())
                    .add(entry(TIED_NANOS, "tied-" + i, MACHINE_ID));
        }
        for (Map.Entry<String, List<List<Object>>> stream : deviceLinesByLevel.entrySet()) {
            push(TENANT_DOMAIN, stream.getKey(), stream.getValue());
        }

        List<List<Object>> otherMachineLines = new ArrayList<>();
        List<List<Object>> otherTenantLines = new ArrayList<>();
        for (int i = 0; i < 20; i++) {
            otherMachineLines.add(entry(BASE_NANOS + i * STEP_NANOS + 7, String.format("other-machine-%02d", i), OTHER_MACHINE_ID));
            otherTenantLines.add(entry(BASE_NANOS + i * STEP_NANOS + 9, String.format("other-tenant-%02d", i), MACHINE_ID));
        }
        push(TENANT_DOMAIN, "INFO", otherMachineLines);
        push(OTHER_TENANT_DOMAIN, "INFO", otherTenantLines);

        awaitLines(MACHINE_ID, DEVICE_LINES + TIED_LINES);
    }

    @Test
    void returnsEveryLineOfTheDeviceAndNothingFromOtherDevicesOrTenants() {
        List<DeviceLogEntry> lines = walk(MACHINE_ID, window(), 100);

        assertThat(lines).hasSize(DEVICE_LINES + TIED_LINES);
        assertThat(lines).extracting(DeviceLogEntry::getMessage).noneMatch(message -> message.startsWith("other-"));
        assertThat(lines).extracting(DeviceLogEntry::getHostname).containsOnly(MACHINE_ID + ".local");
    }

    @Test
    void pagesStayNewestFirstWithoutGapsOrDuplicatesWhenLinesShareATimestamp() {
        // Two-line pages put a page boundary among the five lines that share one nanosecond
        DeviceLogFilterCriteria aroundTie = DeviceLogFilterCriteria.builder()
                .from(instant(TIED_NANOS - 5 * STEP_NANOS))
                .to(instant(TIED_NANOS + 5 * STEP_NANOS))
                .build();

        List<DeviceLogEntry> paged = walk(MACHINE_ID, aroundTie, 2);
        List<DeviceLogEntry> single = service.queryDeviceLogs(MACHINE_ID, aroundTie, page(500, null)).getItems();

        assertThat(paged).hasSize(10 + TIED_LINES);
        assertThat(paged).extracting(DeviceLogServiceIT::key).doesNotHaveDuplicates()
                .containsExactlyElementsOf(single.stream().map(DeviceLogServiceIT::key).toList());
        assertThat(paged).extracting(DeviceLogEntry::getMessage).contains("tied-0", "tied-1", "tied-2", "tied-3", "tied-4");
        assertThat(paged).extracting(DeviceLogEntry::getTimestamp).isSortedAccordingTo(Comparator.reverseOrder());
    }

    @Test
    void servesUpToFiveHundredLinesPerPageAndOneHundredByDefault() {
        GenericQueryResult<DeviceLogEntry> capped = service.queryDeviceLogs(MACHINE_ID, window(), page(1000, null));
        GenericQueryResult<DeviceLogEntry> defaulted = service.queryDeviceLogs(MACHINE_ID, window(), page(null, null));

        assertThat(capped.getItems()).hasSize(500);
        assertThat(capped.getPageInfo().isHasNextPage()).isTrue();
        assertThat(defaulted.getItems()).hasSize(100);
    }

    @Test
    void filtersByLevelSearchAndTimeWindow() {
        List<DeviceLogEntry> errors = walk(MACHINE_ID,
                DeviceLogFilterCriteria.builder().from(FROM).levels(List.of(DeviceLogLevel.ERROR)).build(), 500);
        List<DeviceLogEntry> failures = walk(MACHINE_ID,
                DeviceLogFilterCriteria.builder().from(FROM).contains(List.of("connection", "failed")).build(), 500);
        List<DeviceLogEntry> lastSecond = walk(MACHINE_ID,
                DeviceLogFilterCriteria.builder().from(instant(BASE_NANOS + 590 * STEP_NANOS)).build(), 500);

        assertThat(errors).hasSize(ERROR_LINES + TIED_ERROR_LINES)
                .extracting(DeviceLogEntry::getLevel).containsOnly("ERROR");
        assertThat(failures).hasSize(ERROR_LINES)
                .extracting(DeviceLogEntry::getMessage).allMatch(message -> message.contains("Connection FAILED"));
        assertThat(lastSecond).hasSize(10)
                .extracting(DeviceLogEntry::getMessage).first().isEqualTo("line-599 heartbeat ok");
    }

    @Test
    void matchesSearchTextLiterallySoItCannotWidenTheQuery() {
        List<DeviceLogEntry> hostile = walk(MACHINE_ID,
                DeviceLogFilterCriteria.builder().from(FROM).contains(List.of("\"} or {job=~\".+")).build(), 500);
        List<DeviceLogEntry> regexLooking = walk(MACHINE_ID,
                DeviceLogFilterCriteria.builder().from(FROM).contains(List.of("line-0.0")).build(), 500);
        List<DeviceLogEntry> literal = walk(MACHINE_ID,
                DeviceLogFilterCriteria.builder().from(FROM).contains(List.of("line-010")).build(), 500);

        assertThat(hostile).isEmpty();
        // Unescaped, "." would match line-000 through line-090
        assertThat(regexLooking).isEmpty();
        assertThat(literal).extracting(DeviceLogEntry::getMessage).containsExactly("line-010 heartbeat ok");
    }

    @Test
    void narrowsWithSeveralTermsAndExclusions() {
        List<DeviceLogEntry> allTerms = walk(MACHINE_ID, DeviceLogFilterCriteria.builder().from(FROM)
                .contains(List.of("connection", "failed")).build(), 500);
        List<DeviceLogEntry> withoutADecade = walk(MACHINE_ID, DeviceLogFilterCriteria.builder().from(FROM)
                .contains(List.of("heartbeat")).excludes(List.of("line-01")).build(), 500);
        assertThat(allTerms).hasSize(ERROR_LINES);
        assertThat(withoutADecade).hasSize(DEVICE_LINES - ERROR_LINES - 10)
                .extracting(DeviceLogEntry::getMessage).noneMatch(message -> message.contains("line-01"));
    }

    @Test
    void pollingFromTheNewestLineReturnsItAgainWithEveryNewerLine() throws Exception {
        long seenNanos = BASE_NANOS + 10 * STEP_NANOS;
        push(TENANT_DOMAIN, "INFO", List.of(entry(seenNanos, "poll-seen", POLL_MACHINE_ID)));
        awaitLines(POLL_MACHINE_ID, 1);
        DeviceLogEntry newest = service.queryDeviceLogs(POLL_MACHINE_ID, window(), page(100, null)).getItems().get(0);

        push(TENANT_DOMAIN, "INFO", List.of(
                entry(seenNanos + STEP_NANOS, "poll-new-1", POLL_MACHINE_ID),
                entry(seenNanos + 2 * STEP_NANOS, "poll-new-2", POLL_MACHINE_ID)));
        awaitLines(POLL_MACHINE_ID, 3);

        List<DeviceLogEntry> polled = service.queryDeviceLogs(POLL_MACHINE_ID,
                DeviceLogFilterCriteria.builder().from(newest.getTimestamp()).build(), page(100, null)).getItems();

        assertThat(polled).extracting(DeviceLogEntry::getMessage).containsExactly("poll-new-2", "poll-new-1", "poll-seen");
    }

    private static List<DeviceLogEntry> walk(String machineId, DeviceLogFilterCriteria filter, int pageSize) {
        List<DeviceLogEntry> lines = new ArrayList<>();
        String rawCursor = null;
        for (int pages = 0; pages < 1000; pages++) {
            GenericQueryResult<DeviceLogEntry> result = service.queryDeviceLogs(machineId, filter, page(pageSize, rawCursor));
            lines.addAll(result.getItems());
            if (!result.getPageInfo().isHasNextPage()) {
                return lines;
            }
            rawCursor = CursorCodec.decode(result.getPageInfo().getEndCursor());
        }
        throw new AssertionError("Paging did not finish within 1000 pages");
    }

    private static DeviceLogFilterCriteria window() {
        return DeviceLogFilterCriteria.builder().from(FROM).build();
    }

    private static CursorPaginationCriteria page(Integer limit, String rawCursor) {
        return CursorPaginationCriteria.builder().limit(limit).cursor(rawCursor).build();
    }

    private static String key(DeviceLogEntry entry) {
        return toNanos(entry.getTimestamp()) + "|" + entry.getMessage();
    }

    private static DeviceLogService newService() {
        DeviceService deviceService = mock(DeviceService.class);
        when(deviceService.findByMachineId(anyString())).thenReturn(Optional.of(mock(Machine.class)));
        TenantIdProvider tenantIdProvider = mock(TenantIdProvider.class);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        TenantRepository tenantRepository = mock(TenantRepository.class);
        when(tenantRepository.findById(TENANT_ID))
                .thenReturn(Optional.of(Tenant.builder().id(TENANT_ID).domain(TENANT_DOMAIN).build()));
        return new DeviceLogService(lokiClient, deviceService, tenantIdProvider, tenantRepository);
    }

    private static void awaitLines(String machineId, int expected) throws InterruptedException {
        String query = DeviceLogService.buildQuery(TENANT_DOMAIN, machineId, new DeviceLogFilterCriteria());
        for (int attempt = 0; attempt < 50; attempt++) {
            int found = lokiClient.queryRange(query, toNanos(FROM), toNanos(Instant.now()) + 1, expected + 1,
                    LokiDirection.BACKWARD).size();
            if (found >= expected) {
                return;
            }
            Thread.sleep(200);
        }
        throw new AssertionError("Loki did not return " + expected + " lines for " + machineId);
    }

    private static List<Object> entry(long timestampNanos, String message, String machineId) {
        Map<String, String> metadata = Map.of(
                "machine_id", machineId,
                "hostname", machineId + ".local",
                "agent_ts", instant(timestampNanos).truncatedTo(ChronoUnit.MILLIS).toString(),
                "count", "1");
        return List.of(String.valueOf(timestampNanos), message, metadata);
    }

    private static void push(String tenantDomain, String level, List<List<Object>> values) throws Exception {
        Map<String, String> labels = Map.of("job", "agent-logs", "tenant_domain", tenantDomain, "level", level);
        String body = JSON.writeValueAsString(Map.of("streams", List.of(Map.of("stream", labels, "values", values))));
        HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl() + "/loki/api/v1/push"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
        HttpResponse<String> response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as(response.body()).isEqualTo(204);
    }

    private static String baseUrl() {
        return "http://" + LOKI.getHost() + ":" + LOKI.getMappedPort(3100);
    }

    private static Instant instant(long nanos) {
        return Instant.ofEpochSecond(0, nanos);
    }

    private static long toNanos(Instant instant) {
        return instant.getEpochSecond() * 1_000_000_000L + instant.getNano();
    }
}
