package com.openframe.management.osupdate;

import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsVersionBuild;
import com.openframe.data.repository.rmm.osupdate.OsUpdateRepository;
import com.openframe.data.repository.rmm.osupdate.OsVersionBuildRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.OptimisticLockingFailureException;

import java.time.Instant;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OsUpdateEnrichmentServiceTest {

    private static final String TENANT_ID = "tenant-a";
    private static final Instant ENRICHED_BEFORE = Instant.parse("2026-11-24T10:25:00Z");
    private static final int BATCH_SIZE = 500;
    private static final YearMonth NOVEMBER = YearMonth.of(2026, 11);
    private static final YearMonth OCTOBER = YearMonth.of(2026, 10);
    private static final Instant REFRESHED_BEFORE = Instant.parse("2026-11-25T04:25:00Z");
    private static final Instant STALE = Instant.parse("2026-11-24T10:25:00Z");

    @Mock private OsUpdateRepository osUpdateRepository;
    @Mock private ObjectProvider<OsUpdateEnricher> osUpdateEnrichers;
    @Mock private OsUpdateEnrichmentMetrics osUpdateEnrichmentMetrics;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private OsUpdateEnricher windowsOsUpdateEnricher;
    @Mock private OsVersionBuildRepository osVersionBuildRepository;
    @Mock private MsrcCvrfClient msrcCvrfClient;
    @Captor private ArgumentCaptor<List<OsVersionBuild>> savedOsVersionBuilds;

    @InjectMocks private OsUpdateEnrichmentService service;

    @BeforeEach
    void setUp() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        lenient().when(osUpdateEnrichers.orderedStream()).thenAnswer(invocation -> Stream.of(windowsOsUpdateEnricher));
    }

    @Test
    void enrichNotEnrichedSince_windowsAndMac_windowsEnrichedMacCheckedBothSaved() {
        // setup
        OsUpdate windows = osUpdate("id-1", OsPlatform.WINDOWS);
        OsUpdate mac = osUpdate("id-2", OsPlatform.MACOS);
        givenFirstBatch(windows, mac);
        whenWindowsOnlyApplicable();
        doAnswer(invocation -> {
            invocation.<List<OsUpdate>>getArgument(0).forEach(osUpdate -> {
                osUpdate.setExploited(true);
                osUpdate.setEnrichedAt(invocation.getArgument(1));
            });
            return null;
        }).when(windowsOsUpdateEnricher).enrich(anyList(), any());

        // execution
        service.enrichNotEnrichedSince(ENRICHED_BEFORE, BATCH_SIZE);

        // verifications
        verify(windowsOsUpdateEnricher).enrich(eq(List.of(windows)), any());
        verify(osUpdateRepository).save(windows);
        verify(osUpdateRepository).save(mac);
        assertThat(windows.getExploited()).isTrue();
        assertThat(mac.getEnrichedAt()).isNotNull().isEqualTo(windows.getEnrichedAt());
        verify(osUpdateEnrichmentMetrics).recordNoData(OsPlatform.MACOS);
    }

    @Test
    void enrichNotEnrichedSince_sourceDown_savedNotEnriched() {
        // setup
        OsUpdate windows = osUpdate("id-1", OsPlatform.WINDOWS);
        givenFirstBatch(windows);
        when(windowsOsUpdateEnricher.applicableTo(windows)).thenReturn(true);

        // execution
        service.enrichNotEnrichedSince(ENRICHED_BEFORE, BATCH_SIZE);

        // verifications
        verify(osUpdateRepository).save(windows);
        assertThat(windows.getEnrichedAt()).isNull();
    }

    @Test
    void enrichNotEnrichedSince_enricherThrows_updatesLeftForTheNextRun() {
        // setup
        OsUpdate windows = osUpdate("id-1", OsPlatform.WINDOWS);
        OsUpdate mac = osUpdate("id-2", OsPlatform.MACOS);
        givenFirstBatch(windows, mac);
        whenWindowsOnlyApplicable();
        doAnswer(invocation -> {
            invocation.<List<OsUpdate>>getArgument(0).forEach(osUpdate -> osUpdate.setEnrichedAt(invocation.getArgument(1)));
            throw new IllegalStateException("bug");
        }).when(windowsOsUpdateEnricher).enrich(anyList(), any());

        // execution
        service.enrichNotEnrichedSince(ENRICHED_BEFORE, BATCH_SIZE);

        // verifications
        verify(osUpdateRepository).save(mac);
        verify(osUpdateRepository).save(windows);
        assertThat(windows.getEnrichedAt()).isNull();
        verify(osUpdateEnrichmentMetrics).recordEnricherFailed();
    }

    @Test
    void enrichNotEnrichedSince_nothingStale_nothingSaved() {
        // setup
        givenFirstBatch();

        // execution
        service.enrichNotEnrichedSince(ENRICHED_BEFORE, BATCH_SIZE);

        // verifications
        verify(osUpdateRepository, never()).save(any());
        verify(osUpdateEnrichmentMetrics).recordRun(any());
    }

    @Test
    void enrichNotEnrichedSince_entryChangedMeanwhile_skippedOthersSaved() {
        // setup
        OsUpdate changed = osUpdate("id-1", OsPlatform.MACOS);
        OsUpdate unchanged = osUpdate("id-2", OsPlatform.MACOS);
        givenFirstBatch(changed, unchanged);
        when(osUpdateRepository.save(changed)).thenThrow(new OptimisticLockingFailureException("changed"));

        // execution
        service.enrichNotEnrichedSince(ENRICHED_BEFORE, BATCH_SIZE);

        // verifications
        verify(osUpdateRepository).save(unchanged);
    }

    @Test
    void enrichNotEnrichedSince_firstBatchBroken_nextBatchAfterItsLastIdStillEnriched() {
        // setup
        OsUpdate broken = osUpdate("id-1", OsPlatform.MACOS);
        OsUpdate lastOfBrokenBatch = osUpdate("id-2", OsPlatform.MACOS);
        OsUpdate healthy = osUpdate("id-3", OsPlatform.MACOS);
        when(osUpdateRepository.findEnrichedBefore(TENANT_ID, ENRICHED_BEFORE, null, 2))
                .thenReturn(List.of(broken, lastOfBrokenBatch));
        when(osUpdateRepository.findEnrichedBefore(TENANT_ID, ENRICHED_BEFORE, "id-2", 2))
                .thenReturn(List.of(healthy));
        when(osUpdateRepository.save(broken)).thenThrow(new DataAccessResourceFailureException("broken document"));

        // execution
        service.enrichNotEnrichedSince(ENRICHED_BEFORE, 2);

        // verifications
        verify(osUpdateRepository).save(healthy);
        assertThat(healthy.getEnrichedAt()).isNotNull();
        verify(osUpdateEnrichmentMetrics).recordBatchFailed();
        verify(osUpdateEnrichmentMetrics).recordRun(any());
    }

    @Test
    void enrichNotEnrichedSince_fullBatches_pagesByLastIdUntilAShortOne() {
        // setup
        OsUpdate first = osUpdate("id-1", OsPlatform.MACOS);
        OsUpdate second = osUpdate("id-2", OsPlatform.MACOS);
        when(osUpdateRepository.findEnrichedBefore(TENANT_ID, ENRICHED_BEFORE, null, 1)).thenReturn(List.of(first));
        when(osUpdateRepository.findEnrichedBefore(TENANT_ID, ENRICHED_BEFORE, "id-1", 1)).thenReturn(List.of(second));
        when(osUpdateRepository.findEnrichedBefore(TENANT_ID, ENRICHED_BEFORE, "id-2", 1)).thenReturn(List.of());

        // execution
        service.enrichNotEnrichedSince(ENRICHED_BEFORE, 1);

        // verifications
        verify(osUpdateRepository).save(first);
        verify(osUpdateRepository).save(second);
    }

    @Test
    void refreshOsVersionBuilds_bulletinsOfBothMonths_newVersionStoredHigherBuildRaisedAndNoBuildLowered() {
        // setup
        OsVersionBuild raised = osVersionBuild("11 24H2", "26100.9711", null, STALE);
        OsVersionBuild kept = osVersionBuild("10 22H2", "19045.7900", "19045.7890", STALE);
        when(osVersionBuildRepository.findByTenantIdAndPlatform(TENANT_ID, OsPlatform.WINDOWS))
                .thenReturn(List.of(raised, kept));
        when(msrcCvrfClient.getWindowsBuilds(NOVEMBER)).thenReturn(Map.of(
                "11 24H2", msrcWindowsBuild("26100.10075", "26100.10001"),
                "10 22H2", msrcWindowsBuild("19045.7846", "19045.7800"),
                "11 23H2", msrcWindowsBuild("22631.7711", "22631.7700")));
        when(msrcCvrfClient.getWindowsBuilds(OCTOBER)).thenReturn(Map.of(
                "11 24H2", msrcWindowsBuild("26100.9974", "26100.9911"),
                "11 23H2", msrcWindowsBuild("22631.10001", null),
                "11 25H2", msrcWindowsBuild("26200.9711", null)));

        // execution
        service.refreshOsVersionBuilds(NOVEMBER, REFRESHED_BEFORE);

        // verifications
        verify(osVersionBuildRepository).saveAll(savedOsVersionBuilds.capture());
        assertThat(savedOsVersionBuilds.getValue())
                .extracting(OsVersionBuild::getTenantId, OsVersionBuild::getPlatform, OsVersionBuild::getOsVersion,
                        OsVersionBuild::getLatestBuild, OsVersionBuild::getHotpatchBuild)
                .containsExactlyInAnyOrder(
                        tuple(TENANT_ID, OsPlatform.WINDOWS, "11 24H2", "26100.10075", "26100.10001"),
                        tuple(TENANT_ID, OsPlatform.WINDOWS, "10 22H2", "19045.7900", "19045.7890"),
                        tuple(TENANT_ID, OsPlatform.WINDOWS, "11 23H2", "22631.10001", null),
                        tuple(TENANT_ID, OsPlatform.WINDOWS, "11 25H2", "26200.9711", null));
        assertThat(savedOsVersionBuilds.getValue()).contains(raised, kept)
                .allSatisfy(osVersionBuild -> assertThat(osVersionBuild.getUpdatedAt()).isAfter(REFRESHED_BEFORE));
    }

    @Test
    void refreshOsVersionBuilds_currentMonthNotPublishedYet_buildsOfThePreviousMonth() {
        // setup
        when(osVersionBuildRepository.findByTenantIdAndPlatform(TENANT_ID, OsPlatform.WINDOWS)).thenReturn(List.of());
        when(msrcCvrfClient.getWindowsBuilds(NOVEMBER)).thenReturn(Map.of());
        when(msrcCvrfClient.getWindowsBuilds(OCTOBER))
                .thenReturn(Map.of("11 24H2", msrcWindowsBuild("26100.9711", null)));

        // execution
        service.refreshOsVersionBuilds(NOVEMBER, REFRESHED_BEFORE);

        // verifications
        verify(osVersionBuildRepository).saveAll(savedOsVersionBuilds.capture());
        assertThat(savedOsVersionBuilds.getValue())
                .extracting(OsVersionBuild::getOsVersion, OsVersionBuild::getLatestBuild)
                .containsExactly(tuple("11 24H2", "26100.9711"));
    }

    @Test
    void refreshOsVersionBuilds_oneBulletinFailed_storedBuildsLeftAsTheyAre() {
        // setup
        OsVersionBuild stored = osVersionBuild("11 24H2", "26100.9711", null, STALE);
        when(osVersionBuildRepository.findByTenantIdAndPlatform(TENANT_ID, OsPlatform.WINDOWS))
                .thenReturn(List.of(stored));
        lenient().when(msrcCvrfClient.getWindowsBuilds(NOVEMBER))
                .thenReturn(Map.of("11 24H2", msrcWindowsBuild("26100.9974", "26100.9911")));
        when(msrcCvrfClient.getWindowsBuilds(OCTOBER))
                .thenThrow(new OsUpdateSourceUnavailableException(OsUpdateSource.MSRC_CVRF, "MSRC answered 503"));

        // execution
        service.refreshOsVersionBuilds(NOVEMBER, REFRESHED_BEFORE);

        // verifications
        verify(osVersionBuildRepository, never()).saveAll(any());
        assertThat(stored.getLatestBuild()).isEqualTo("26100.9711");
        assertThat(stored.getHotpatchBuild()).isNull();
        assertThat(stored.getUpdatedAt()).isEqualTo(STALE);
    }

    @Test
    void refreshOsVersionBuilds_refreshedWithinTheInterval_bulletinsNotAsked() {
        // setup
        OsVersionBuild stale = osVersionBuild("10 22H2", "19045.7846", null, STALE);
        OsVersionBuild fresh = osVersionBuild("11 24H2", "26100.9711", null, REFRESHED_BEFORE.plusSeconds(1));
        when(osVersionBuildRepository.findByTenantIdAndPlatform(TENANT_ID, OsPlatform.WINDOWS))
                .thenReturn(List.of(stale, fresh));

        // execution
        service.refreshOsVersionBuilds(NOVEMBER, REFRESHED_BEFORE);

        // verifications
        verifyNoInteractions(msrcCvrfClient);
        verify(osVersionBuildRepository, never()).saveAll(any());
    }

    @Test
    void refreshOsVersionBuilds_latestBuildMovesToAMonthWithoutHotpatch_hotpatchBuildCleared() {
        // setup
        OsVersionBuild hotpatched = osVersionBuild("11 24H2", "26100.9974", "26100.9911", STALE);
        when(osVersionBuildRepository.findByTenantIdAndPlatform(TENANT_ID, OsPlatform.WINDOWS))
                .thenReturn(List.of(hotpatched));
        when(msrcCvrfClient.getWindowsBuilds(NOVEMBER))
                .thenReturn(Map.of("11 24H2", msrcWindowsBuild("26100.10200", null)));
        when(msrcCvrfClient.getWindowsBuilds(OCTOBER))
                .thenReturn(Map.of("11 24H2", msrcWindowsBuild("26100.9974", "26100.9911")));

        // execution
        service.refreshOsVersionBuilds(NOVEMBER, REFRESHED_BEFORE);

        // verifications
        assertThat(hotpatched.getLatestBuild()).isEqualTo("26100.10200");
        assertThat(hotpatched.getHotpatchBuild()).isNull();
    }

    @Test
    void refreshOsVersionBuilds_sameLatestBuildInBothMonthsOneWithItsHotpatch_hotpatchBuildOfThatLatestBuild() {
        // setup
        OsVersionBuild withoutHotpatch = osVersionBuild("11 24H2", "26100.9974", null, STALE);
        OsVersionBuild withStaleHotpatch = osVersionBuild("11 25H2", "26200.9974", "26200.9000", STALE);
        when(osVersionBuildRepository.findByTenantIdAndPlatform(TENANT_ID, OsPlatform.WINDOWS))
                .thenReturn(List.of(withoutHotpatch, withStaleHotpatch));
        when(msrcCvrfClient.getWindowsBuilds(NOVEMBER)).thenReturn(Map.of(
                "11 24H2", msrcWindowsBuild("26100.9974", null),
                "11 25H2", msrcWindowsBuild("26200.9974", "26200.9911")));
        when(msrcCvrfClient.getWindowsBuilds(OCTOBER)).thenReturn(Map.of(
                "11 24H2", msrcWindowsBuild("26100.9974", "26100.9911"),
                "11 25H2", msrcWindowsBuild("26200.9974", null)));

        // execution
        service.refreshOsVersionBuilds(NOVEMBER, REFRESHED_BEFORE);

        // verifications
        assertThat(withoutHotpatch.getHotpatchBuild()).isEqualTo("26100.9911");
        assertThat(withStaleHotpatch.getHotpatchBuild()).isEqualTo("26200.9911");
    }

    private static MsrcWindowsBuild msrcWindowsBuild(String latestBuild, String hotpatchBuild) {
        return MsrcWindowsBuild.builder().latestBuild(latestBuild).hotpatchBuild(hotpatchBuild).build();
    }

    private static OsVersionBuild osVersionBuild(String osVersion, String latestBuild, String hotpatchBuild,
                                                 Instant updatedAt) {
        return OsVersionBuild.builder()
                .id("id-" + osVersion)
                .tenantId(TENANT_ID)
                .platform(OsPlatform.WINDOWS)
                .osVersion(osVersion)
                .latestBuild(latestBuild)
                .hotpatchBuild(hotpatchBuild)
                .updatedAt(updatedAt)
                .build();
    }

    private void givenFirstBatch(OsUpdate... staleOsUpdates) {
        when(osUpdateRepository.findEnrichedBefore(TENANT_ID, ENRICHED_BEFORE, null, BATCH_SIZE))
                .thenReturn(List.of(staleOsUpdates));
    }

    private void whenWindowsOnlyApplicable() {
        when(windowsOsUpdateEnricher.applicableTo(any())).thenAnswer(invocation ->
                invocation.<OsUpdate>getArgument(0).getPlatform() == OsPlatform.WINDOWS);
    }

    private static OsUpdate osUpdate(String id, OsPlatform platform) {
        return OsUpdate.builder()
                .id(id)
                .tenantId(TENANT_ID)
                .platform(platform)
                .identifier(id)
                .build();
    }
}
