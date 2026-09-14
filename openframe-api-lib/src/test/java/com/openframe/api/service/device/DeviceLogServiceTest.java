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
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(mock(Machine.class)));
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(tenantRepository.findById(TENANT_ID))
                .thenReturn(Optional.of(Tenant.builder().id(TENANT_ID).domain(TENANT_DOMAIN).build()));
    }

    @Test
    void pinsSelectorToTheTenantDomainAndEscapesFilters() {
        DeviceLogFilterCriteria filter = DeviceLogFilterCriteria.builder()
                .levels(List.of(DeviceLogLevel.ERROR, DeviceLogLevel.WARN))
                .search("a\"b")
                .from(FROM)
                .to(TO)
                .build();

        service.queryDeviceLogs(MACHINE_ID, filter, page(null, null));

        verify(lokiClient).queryRange(
                "{job=\"agent-logs\", tenant_domain=\"acme.openframe.ai\", level=~\"ERROR|WARN\"}"
                        + " |~ \"(?i)a\\\"b\" | machine_id=\"machine-1\"",
                FROM_NANOS, TO_NANOS + 1, 21, LokiDirection.BACKWARD);
    }

    @Test
    void defaultsToTheLastSevenDaysWithoutLevelOrSearchFilters() {
        service.queryDeviceLogs(MACHINE_ID, DeviceLogFilterCriteria.builder().to(TO).build(), page(null, null));

        verify(lokiClient).queryRange(
                "{job=\"agent-logs\", tenant_domain=\"acme.openframe.ai\"} | machine_id=\"machine-1\"",
                TO_NANOS - Duration.ofDays(7).toNanos(), TO_NANOS + 1, 21, LokiDirection.BACKWARD);
    }

    @Test
    void rejectsDevicesNotVisibleToTheTenant() {
        when(deviceService.findByMachineId("other-tenant-machine")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.queryDeviceLogs("other-tenant-machine", null, page(null, null)))
                .isInstanceOf(DeviceNotFoundException.class);
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
        assertThat(result.getPageInfo().getStartCursor()).isEqualTo(CursorCodec.encode("300:1"));
        assertThat(result.getPageInfo().getEndCursor()).isEqualTo(CursorCodec.encode("200:1"));
    }

    @Test
    void nextPageSkipsEntriesAlreadyReturnedAtTheCursorTimestamp() {
        long cursorNanos = TO_NANOS - 500;
        when(lokiClient.queryRange(anyString(), eq(FROM_NANOS), eq(cursorNanos + 1), eq(4), eq(LokiDirection.BACKWARD)))
                .thenReturn(List.of(entry(cursorNanos, "b1"), entry(cursorNanos, "b2"), entry(cursorNanos - 1, "a")));

        GenericQueryResult<DeviceLogEntry> result =
                service.queryDeviceLogs(MACHINE_ID, window(), page(2, cursorNanos + ":1"));

        assertThat(result.getItems()).extracting(DeviceLogEntry::getMessage).containsExactly("b2", "a");
        assertThat(result.getItems()).extracting(DeviceLogEntry::getCursor)
                .containsExactly(CursorCodec.encode(cursorNanos + ":2"), CursorCodec.encode((cursorNanos - 1) + ":1"));
        assertThat(result.getPageInfo().isHasNextPage()).isFalse();
        assertThat(result.getPageInfo().isHasPreviousPage()).isTrue();
    }

    @Test
    void cursorBeforeTheWindowReturnsAnEmptyPageWithoutQuerying() {
        GenericQueryResult<DeviceLogEntry> result =
                service.queryDeviceLogs(MACHINE_ID, window(), page(2, (FROM_NANOS - 1) + ":1"));

        assertThat(result.getItems()).isEmpty();
        assertThat(result.getPageInfo().isHasNextPage()).isFalse();
        verifyNoInteractions(lokiClient);
    }

    @Test
    void mapsStructuredMetadataOntoTheEntry() {
        when(lokiClient.queryRange(anyString(), anyLong(), anyLong(), anyInt(), eq(LokiDirection.BACKWARD)))
                .thenReturn(List.of(new LokiLogEntry(TO_NANOS + 35, "Control channel disconnected", Map.of(
                        "level", "ERROR",
                        "hostname", "Mishas-MacBook-Pro.local",
                        "agent_ts", "2026-09-14T11:59:59.487Z",
                        "count", "2"))));

        DeviceLogEntry entry = service.queryDeviceLogs(MACHINE_ID, window(), page(null, null)).getItems().get(0);

        assertThat(entry.getTimestamp()).isEqualTo(TO.plusNanos(35));
        assertThat(entry.getAgentTimestamp()).isEqualTo(Instant.parse("2026-09-14T11:59:59.487Z"));
        assertThat(entry.getLevel()).isEqualTo("ERROR");
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
                DeviceLogFilterCriteria.builder().from(FROM).to(TO).search("x".repeat(257)).build(), page(null, null)))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(lokiClient);
    }

    private static DeviceLogFilterCriteria window() {
        return DeviceLogFilterCriteria.builder().from(FROM).to(TO).build();
    }

    private static CursorPaginationCriteria page(Integer limit, String rawCursor) {
        return CursorPaginationCriteria.builder().limit(limit).cursor(rawCursor).build();
    }

    private static LokiLogEntry entry(long timestampNanos, String line) {
        return new LokiLogEntry(timestampNanos, line, Map.of("level", "INFO"));
    }
}
