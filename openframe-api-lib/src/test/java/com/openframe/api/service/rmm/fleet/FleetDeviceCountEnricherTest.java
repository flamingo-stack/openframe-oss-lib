package com.openframe.api.service.rmm.fleet;

import com.openframe.data.document.device.Machine;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.sdk.fleetmdm.model.Host;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetDeviceCountEnricherTest {

    @Mock private FleetHostMachineResolver hostMachineResolver;
    @Mock private TenantIdProvider tenantIdProvider;

    private FleetDeviceCountEnricher enricher;

    @BeforeEach
    void setUp() {
        enricher = new FleetDeviceCountEnricher(hostMachineResolver, tenantIdProvider);
    }

    @Test
    void enrich_setsCountToCorrelatedHostsPerRow_orphansDropped() {
        Row rowA = new Row("A");
        Row rowB = new Row("B");
        Host h1 = host(1L);
        Host h2 = host(2L);   // orphan — no matching Machine
        Host h3 = host(3L);
        when(tenantIdProvider.getTenantId()).thenReturn("t1");
        when(hostMachineResolver.resolve(eq("t1"), anyList()))
                .thenReturn(Map.of(1L, new Machine(), 3L, new Machine()));

        enricher.enrich(
                List.of(rowA, rowB),
                row -> row.name.equals("A") ? List.of(h1, h2) : List.of(h3),
                Row::setCount);

        assertThat(rowA.count).isEqualTo(1);   // h2 dropped as orphan
        assertThat(rowB.count).isEqualTo(1);
    }

    @Test
    void enrich_batchesCorrelateIntoOneResolverCall_notPerRow() {
        // Invariant: N rows → 1 resolver.resolve(...) call over the UNION of every row's hosts.
        List<Row> rows = List.of(new Row("A"), new Row("B"), new Row("C"));
        when(tenantIdProvider.getTenantId()).thenReturn("t1");
        when(hostMachineResolver.resolve(eq("t1"), anyList())).thenReturn(Map.of());

        enricher.enrich(rows, row -> List.of(host(1L)), Row::setCount);

        verify(hostMachineResolver, times(1)).resolve(eq("t1"), anyList());
    }

    @Test
    void enrich_callsHostFetcherOncePerRow_neverMore() {
        // Invariant: exactly one Fleet /hosts call per row (parallel is OK, N > per-row is NOT).
        AtomicInteger fetchCalls = new AtomicInteger();
        when(tenantIdProvider.getTenantId()).thenReturn("t1");
        when(hostMachineResolver.resolve(eq("t1"), anyList())).thenReturn(Map.of());
        List<Row> rows = new ArrayList<>(List.of(new Row("A"), new Row("B"), new Row("C"), new Row("D")));

        enricher.enrich(rows,
                row -> { fetchCalls.incrementAndGet(); return List.of(host(1L)); },
                Row::setCount);

        assertThat(fetchCalls).hasValue(rows.size());
    }

    @Test
    void enrich_correlateReceivesTheUnionOfAllRows_hosts() {
        // Invariant: the resolver is asked about the FULL union — a host appearing on more than one
        // row is still resolved once, and every row's hosts are eligible for correlation.
        Row rowA = new Row("A");
        Row rowB = new Row("B");
        Host shared = host(1L);
        Host rowBOnly = host(2L);
        when(tenantIdProvider.getTenantId()).thenReturn("t1");
        ArgumentCaptor<List<Host>> captor = ArgumentCaptor.forClass(List.class);
        when(hostMachineResolver.resolve(eq("t1"), captor.capture())).thenReturn(Map.of());

        enricher.enrich(
                List.of(rowA, rowB),
                row -> row.name.equals("A") ? List.of(shared) : List.of(shared, rowBOnly),
                Row::setCount);

        // The captured list should contain every host the fetchers produced (duplicates allowed —
        // the resolver's Mongo query naturally dedups; we don't slim it here to keep the enricher generic).
        assertThat(captor.getValue()).contains(shared, rowBOnly);
    }

    @Test
    void enrich_emptyRows_noResolverCall_noFleetCall() {
        // Empty page must not call the resolver — no work to do, no wasted round-trip.
        enricher.enrich(List.of(), row -> List.of(host(1L)), (r, c) -> {});

        verifyNoInteractions(hostMachineResolver, tenantIdProvider);
    }

    @Test
    void enrich_nullRows_isANoOp() {
        // Defensive: null callers (from an upstream that couldn't build a page) don't NPE.
        enricher.enrich(null, row -> List.of(), (r, c) -> {});

        verifyNoInteractions(hostMachineResolver, tenantIdProvider);
    }

    @Test
    void enrich_rowWithNoHosts_setsZeroCount() {
        // A row whose fetcher returns [] must get count = 0 (not left untouched).
        Row row = new Row("A");
        row.count = -1;    // sentinel: fails if we forget to write
        when(tenantIdProvider.getTenantId()).thenReturn("t1");
        when(hostMachineResolver.resolve(eq("t1"), anyList())).thenReturn(Map.of());

        enricher.enrich(List.of(row), r -> List.of(), Row::setCount);

        assertThat(row.count).isZero();
    }

    private static Host host(long id) {
        Host h = new Host();
        h.setId(id);
        return h;
    }

    private static class Row {
        final String name;
        int count = -1;

        Row(String name) {
            this.name = name;
        }

        void setCount(int c) {
            this.count = c;
        }
    }
}
