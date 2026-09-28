package com.openframe.api.service.device;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.device.DeviceLogEntry;
import com.openframe.api.dto.device.DeviceLogFilterCriteria;
import com.openframe.api.dto.device.DeviceLogLevel;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.core.exception.InternalException;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.loki.client.LokiClient;
import com.openframe.data.loki.model.LokiDirection;
import com.openframe.data.loki.model.LokiLogEntry;
import com.openframe.data.repository.tenant.TenantRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Collection;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DeviceLogServiceTest {

    private static final String MACHINE_ID = "machine-1";
    private static final String TENANT_ID = "tenant-1";
    private static final String TENANT_DOMAIN = "acme.openframe.ai";
    private static final Instant TO = Instant.parse("2026-09-14T12:00:00Z");
    private static final Instant FROM = TO.minus(Duration.ofDays(1));
    private static final long TO_NANOS = TO.getEpochSecond() * 1_000_000_000L;
    private static final long FROM_NANOS = FROM.getEpochSecond() * 1_000_000_000L;

    @Mock private LokiClient lokiClient;
    @Mock private DeviceService deviceService;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private TenantRepository tenantRepository;

    private DeviceLogService service;

    @BeforeEach
    void setUp() {
        service = new DeviceLogService(lokiClient, deviceService, tenantIdProvider, tenantRepository);
        when(deviceService.findByMachineIds(anyCollection())).thenAnswer(invocation ->
                invocation.<Collection<String>>getArgument(0).stream().map(DeviceLogServiceTest::machine).toList());
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(tenantRepository.findById(TENANT_ID))
                .thenReturn(Optional.of(Tenant.builder().id(TENANT_ID).domain(TENANT_DOMAIN).build()));
    }

    @Test
    void pinsSelectorToTheTenantDomainAndEscapesFilters() {
        DeviceLogFilterCriteria filter = DeviceLogFilterCriteria.builder()
                .levels(List.of(DeviceLogLevel.ERROR, DeviceLogLevel.WARN))
                .contains(List.of("a\"b"))
                .from(FROM)
                .to(TO)
                .build();

        service.queryDeviceLogs(MACHINE_ID, filter, page(null, null));

        verify(lokiClient).queryRange(
                "{job=\"agent-logs\", tenant_domain=\"acme.openframe.ai\", level=~\"ERROR|WARN\"}"
                        + " |~ \"(?i)a\\\"b\" | machine_id=\"machine-1\"",
                FROM_NANOS, TO_NANOS + 1, 101, LokiDirection.BACKWARD);
    }

    @Test
    void defaultsToTheLastSevenDaysWithoutLevelOrSearchFilters() {
        service.queryDeviceLogs(MACHINE_ID, DeviceLogFilterCriteria.builder().to(TO).build(), page(null, null));

        verify(lokiClient).queryRange(
                "{job=\"agent-logs\", tenant_domain=\"acme.openframe.ai\"} | machine_id=\"machine-1\"",
                TO_NANOS - Duration.ofDays(7).toNanos(), TO_NANOS + 1, 101, LokiDirection.BACKWARD);
    }

    @Test
    void clampsThePageSizeBetweenOneAndFiveHundredLines() {
        service.queryDeviceLogs(MACHINE_ID, window(), page(1000, null));
        service.queryDeviceLogs(MACHINE_ID, window(), page(0, null));

        verify(lokiClient).queryRange(anyString(), anyLong(), anyLong(), eq(501), eq(LokiDirection.BACKWARD));
        verify(lokiClient).queryRange(anyString(), anyLong(), anyLong(), eq(2), eq(LokiDirection.BACKWARD));
    }

    @Test
    void rejectsDevicesNotVisibleToTheTenant() {
        when(deviceService.findByMachineIds(anyCollection())).thenReturn(List.of());

        assertThatThrownBy(() -> service.queryDeviceLogs("other-tenant-machine", null, page(null, null)))
                .isInstanceOf(DeviceNotFoundException.class);
        verifyNoInteractions(lokiClient);
    }

    @Test
    void rejectsTheWholeRequestWhenOneOfSeveralDevicesIsNotVisibleToTheTenant() {
        when(deviceService.findByMachineIds(anyCollection())).thenReturn(List.of(machine(MACHINE_ID)));

        assertThatThrownBy(() -> service.queryLogs(List.of(MACHINE_ID, "other-tenant-machine"), window(), page(null, null)))
                .isInstanceOf(DeviceNotFoundException.class)
                .hasMessageContaining("other-tenant-machine");
        verifyNoInteractions(lokiClient);
    }

    @Test
    void chainsSeveralDevicesWithOrAndKeepsASingleDeviceUnchanged() {
        service.queryLogs(List.of(MACHINE_ID, "machine-2", MACHINE_ID), window(), page(null, null));

        verify(lokiClient).queryRange(
                "{job=\"agent-logs\", tenant_domain=\"acme.openframe.ai\"}"
                        + " | machine_id=\"machine-1\" or machine_id=\"machine-2\"",
                FROM_NANOS, TO_NANOS + 1, 101, LokiDirection.BACKWARD);
    }

    @Test
    void queriesEveryDeviceOfTheTenantWithoutAMetadataFilterAndLooksBackOneDay() {
        service.queryLogs(null, DeviceLogFilterCriteria.builder().to(TO).build(), page(null, null));

        verify(lokiClient).queryRange(
                "{job=\"agent-logs\", tenant_domain=\"acme.openframe.ai\"}",
                TO_NANOS - Duration.ofDays(1).toNanos(), TO_NANOS + 1, 101, LokiDirection.BACKWARD);
        verifyNoInteractions(deviceService);
    }

    @Test
    void rejectsAnEmptyDeviceListSoAHalfLoadedClientCannotQueryTheWholeTenant() {
        assertThatThrownBy(() -> service.queryLogs(List.of(), window(), page(null, null)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("at least one device");
        assertThatThrownBy(() -> service.queryLogs(List.of(" "), window(), page(null, null)))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(lokiClient);
    }

    @Test
    void rejectsANullDeviceIdRatherThanWideningToTheWholeTenant() {
        // singletonList(null) is not the null list that means "every device": the id is filtered out, the list is
        // then empty, and an empty-but-present list is rejected
        assertThatThrownBy(() -> service.queryDeviceLogs(null, window(), page(null, null)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("at least one device");
        verifyNoInteractions(lokiClient);
    }

    @Test
    void rejectsMoreThanFiftyDevices() {
        List<String> tooMany = java.util.stream.IntStream.range(0, 51).mapToObj(i -> "machine-" + i).toList();

        assertThatThrownBy(() -> service.queryLogs(tooMany, window(), page(null, null)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("50 devices");
        verifyNoInteractions(lokiClient);
    }

    @Test
    void failsWhenTheTenantHasNoDomain() {
        when(tenantRepository.findById(TENANT_ID)).thenReturn(Optional.of(Tenant.builder().id(TENANT_ID).build()));

        assertThatThrownBy(() -> service.queryDeviceLogs(MACHINE_ID, window(), page(null, null)))
                .isInstanceOf(InternalException.class);
        verifyNoInteractions(lokiClient);
    }

    @Test
    void cachesTheTenantDomainAcrossRequests() {
        service.queryDeviceLogs(MACHINE_ID, window(), page(null, null));
        service.queryDeviceLogs(MACHINE_ID, window(), page(null, null));

        verify(tenantRepository, times(1)).findById(TENANT_ID);
    }

    @Test
    void doesNotCacheAMissingDomain() {
        when(tenantRepository.findById(TENANT_ID))
                .thenReturn(Optional.of(Tenant.builder().id(TENANT_ID).build()))
                .thenReturn(Optional.of(Tenant.builder().id(TENANT_ID).domain(TENANT_DOMAIN).build()));

        assertThatThrownBy(() -> service.queryDeviceLogs(MACHINE_ID, window(), page(null, null)))
                .isInstanceOf(InternalException.class);
        service.queryDeviceLogs(MACHINE_ID, window(), page(null, null));

        verify(tenantRepository, times(2)).findById(TENANT_ID);
        verify(lokiClient).queryRange(startsWith("{job=\"agent-logs\", tenant_domain=\"acme.openframe.ai\""),
                anyLong(), anyLong(), anyInt(), eq(LokiDirection.BACKWARD));
    }

    @Test
    void firstPageReportsNextPageAndCursors() {
        when(lokiClient.queryRange(anyString(), anyLong(), anyLong(), eq(3), eq(LokiDirection.BACKWARD)))
                .thenReturn(List.of(entry(300, "c"), entry(200, "b"), entry(100, "a")));

        GenericQueryResult<DeviceLogEntry> result = service.queryDeviceLogs(MACHINE_ID, window(), page(2, null));

        assertThat(result.getItems()).extracting(DeviceLogEntry::getMessage).containsExactly("c", "b");
        assertThat(result.getPageInfo().isHasNextPage()).isTrue();
        assertThat(result.getPageInfo().isHasPreviousPage()).isFalse();
        assertThat(result.getPageInfo().getStartCursor()).isEqualTo(CursorCodec.encode("300"));
        assertThat(result.getPageInfo().getEndCursor()).isEqualTo(CursorCodec.encode("200"));
    }

    @Test
    void nextPageEndsJustBeforeTheCursorTimestamp() {
        long cursorNanos = TO_NANOS - 500;
        when(lokiClient.queryRange(anyString(), eq(FROM_NANOS), eq(cursorNanos), eq(3), eq(LokiDirection.BACKWARD)))
                .thenReturn(List.of(entry(cursorNanos - 1, "b"), entry(cursorNanos - 2, "a")));

        GenericQueryResult<DeviceLogEntry> result =
                service.queryDeviceLogs(MACHINE_ID, window(), page(2, String.valueOf(cursorNanos)));

        assertThat(result.getItems()).extracting(DeviceLogEntry::getMessage).containsExactly("b", "a");
        assertThat(result.getPageInfo().isHasNextPage()).isFalse();
        assertThat(result.getPageInfo().isHasPreviousPage()).isTrue();
    }

    @Test
    void endsAPageBeforeLinesThatShareTheCutTimestamp() {
        // Loki cut the lines at 200 ns at the limit, keeping whichever it chose
        when(lokiClient.queryRange(anyString(), anyLong(), anyLong(), eq(3), eq(LokiDirection.BACKWARD)))
                .thenReturn(List.of(entry(300, "c"), entry(200, "b1"), entry(200, "b2")));

        GenericQueryResult<DeviceLogEntry> result = service.queryDeviceLogs(MACHINE_ID, window(), page(2, null));

        assertThat(result.getItems()).extracting(DeviceLogEntry::getMessage).containsExactly("c");
        assertThat(result.getPageInfo().isHasNextPage()).isTrue();
        assertThat(result.getPageInfo().getEndCursor()).isEqualTo(CursorCodec.encode("300"));
    }

    @Test
    void returnsEveryLineOfATimestampThatFillsTheWholePage() {
        when(lokiClient.queryRange(anyString(), anyLong(), anyLong(), eq(3), eq(LokiDirection.BACKWARD)))
                .thenReturn(List.of(entry(200, "a"), entry(200, "b"), entry(200, "c")));
        when(lokiClient.queryRange(anyString(), eq(200L), eq(201L), eq(5000), eq(LokiDirection.BACKWARD)))
                .thenReturn(List.of(entry(200, "a"), entry(200, "b"), entry(200, "c"), entry(200, "d")));

        GenericQueryResult<DeviceLogEntry> result = service.queryDeviceLogs(MACHINE_ID, window(), page(2, null));

        assertThat(result.getItems()).extracting(DeviceLogEntry::getMessage).containsExactly("a", "b", "c", "d");
        assertThat(result.getPageInfo().isHasNextPage()).isTrue();
        assertThat(result.getPageInfo().getEndCursor()).isEqualTo(CursorCodec.encode("200"));
    }

    @Test
    void cursorBeforeTheWindowReturnsAnEmptyPageWithoutQuerying() {
        GenericQueryResult<DeviceLogEntry> result =
                service.queryDeviceLogs(MACHINE_ID, window(), page(2, String.valueOf(FROM_NANOS - 1)));

        assertThat(result.getItems()).isEmpty();
        assertThat(result.getPageInfo().isHasNextPage()).isFalse();
        verifyNoInteractions(lokiClient);
    }

    @Test
    void mapsStructuredMetadataOntoTheEntry() {
        when(lokiClient.queryRange(anyString(), anyLong(), anyLong(), anyInt(), eq(LokiDirection.BACKWARD)))
                .thenReturn(List.of(new LokiLogEntry(TO_NANOS + 35, "Control channel disconnected", Map.of(
                        "level", "ERROR",
                        "machine_id", MACHINE_ID,
                        "hostname", "Mishas-MacBook-Pro.local",
                        "agent_ts", "2026-09-14T11:59:59.487Z",
                        "count", "2"))));

        DeviceLogEntry entry = service.queryDeviceLogs(MACHINE_ID, window(), page(null, null)).getItems().get(0);

        assertThat(entry.getTimestamp()).isEqualTo(TO.plusNanos(35));
        assertThat(entry.getAgentTimestamp()).isEqualTo(Instant.parse("2026-09-14T11:59:59.487Z"));
        assertThat(entry.getLevel()).isEqualTo("ERROR");
        assertThat(entry.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(entry.getHostname()).isEqualTo("Mishas-MacBook-Pro.local");
        assertThat(entry.getCount()).isEqualTo(2L);
    }

    @Test
    void rejectsMalformedCursorsRangesAndSearches() {
        assertThatThrownBy(() -> service.queryDeviceLogs(MACHINE_ID, window(), page(null, "garbage")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.queryDeviceLogs(MACHINE_ID,
                DeviceLogFilterCriteria.builder().from(TO.minus(Duration.ofDays(31))).to(TO).build(), page(null, null)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.queryDeviceLogs(MACHINE_ID,
                DeviceLogFilterCriteria.builder().from(FROM).to(TO).contains(List.of("x".repeat(257))).build(),
                page(null, null)))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(lokiClient);
    }

    @Test
    void buildsOneLineFilterPerTermBeforeTheMetadataFilter() {
        DeviceLogFilterCriteria filter = DeviceLogFilterCriteria.builder()
                .contains(List.of("connection", "failed"))
                .excludes(List.of("heartbeat"))
                .from(FROM)
                .to(TO)
                .build();

        service.queryDeviceLogs(MACHINE_ID, filter, page(null, null));

        verify(lokiClient).queryRange(
                "{job=\"agent-logs\", tenant_domain=\"acme.openframe.ai\"}"
                        + " |~ \"(?i)connection\" |~ \"(?i)failed\" !~ \"(?i)heartbeat\""
                        + " | machine_id=\"machine-1\"",
                FROM_NANOS, TO_NANOS + 1, 101, LokiDirection.BACKWARD);
    }

    @Test
    void rejectsMoreThanFiveTerms() {
        assertThatThrownBy(() -> service.queryDeviceLogs(MACHINE_ID, DeviceLogFilterCriteria.builder().from(FROM).to(TO)
                .contains(List.of("a", "b", "c", "d", "e", "f")).build(), page(null, null)))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(lokiClient);
    }

    @Test
    void ignoresBlankTerms() {
        service.queryDeviceLogs(MACHINE_ID, DeviceLogFilterCriteria.builder().from(FROM).to(TO)
                .contains(List.of("a", "", "  ", "b", "c", "d", "e")).build(), page(null, null));

        // The two blank terms neither reach the query nor count towards the five-term limit
        verify(lokiClient).queryRange(
                "{job=\"agent-logs\", tenant_domain=\"acme.openframe.ai\"}"
                        + " |~ \"(?i)a\" |~ \"(?i)b\" |~ \"(?i)c\" |~ \"(?i)d\" |~ \"(?i)e\""
                        + " | machine_id=\"machine-1\"",
                FROM_NANOS, TO_NANOS + 1, 101, LokiDirection.BACKWARD);
    }

    private static DeviceLogFilterCriteria window() {
        return DeviceLogFilterCriteria.builder().from(FROM).to(TO).build();
    }

    private static Machine machine(String machineId) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        return machine;
    }

    private static CursorPaginationCriteria page(Integer limit, String rawCursor) {
        return CursorPaginationCriteria.builder().limit(limit).cursor(rawCursor).build();
    }

    private static LokiLogEntry entry(long timestampNanos, String line) {
        return new LokiLogEntry(timestampNanos, line, Map.of("level", "INFO"));
    }
}
