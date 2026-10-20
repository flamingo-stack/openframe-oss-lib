package com.openframe.stream.enrichment;

import com.openframe.data.document.rmm.software.CveMetadata;
import com.openframe.data.document.rmm.software.TenantCve;
import com.openframe.data.repository.rmm.software.CveMetadataRepository;
import com.openframe.data.repository.rmm.software.TenantCveRepository;
import com.openframe.stream.enrichment.NvdClient.NvdCveData;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CveEnrichmentServiceTest {

    private static final String CVE = "CVE-2024-0001";
    private static final Instant PUBLISHED = Instant.parse("2024-01-01T00:00:00Z");

    @Mock private CveMetadataRepository cveMetadataRepository;
    @Mock private TenantCveRepository tenantCveRepository;
    @Mock private NvdClient nvdClient;
    @Mock private EpssClient epssClient;
    @Mock private CisaKevClient cisaKevClient;

    private CveEnrichmentService service(boolean nvd, boolean epss, boolean kev) {
        return new CveEnrichmentService(cveMetadataRepository, tenantCveRepository, nvdClient, epssClient,
                cisaKevClient, 0L, nvd, epss, kev);
    }

    private CveMetadata meta() {
        return CveMetadata.builder().cveId(CVE).build();
    }

    @Test
    void enrich_mergesAllSourcesAndStampsCacheMarker() {
        CveMetadata metadata = meta();
        when(nvdClient.fetch(CVE)).thenReturn(new NvdCveData(7.8, "HIGH", PUBLISHED, "buffer overflow", "CWE-120"));
        when(epssClient.fetch(any())).thenReturn(Map.of(CVE, 0.42));
        when(cisaKevClient.knownExploitedCves()).thenReturn(Set.of(CVE));
        when(tenantCveRepository.findByCveId(CVE)).thenReturn(List.of());

        service(true, true, true).enrich(List.of(metadata));

        assertThat(metadata.getCvssScore()).isEqualTo(7.8);
        assertThat(metadata.getSeverity()).isEqualTo("HIGH");
        assertThat(metadata.getPublishedAt()).isEqualTo(PUBLISHED);
        assertThat(metadata.getDescription()).isEqualTo("buffer overflow");
        assertThat(metadata.getCweId()).isEqualTo("CWE-120");
        assertThat(metadata.getEpssProbability()).isEqualTo(0.42);
        assertThat(metadata.getCisaKnownExploit()).isTrue();
        assertThat(metadata.getSource()).isEqualTo("external");
        assertThat(metadata.getCachedAt()).isNotNull();
        verify(cveMetadataRepository).save(metadata);
    }

    @Test
    void enrich_fansEnrichedValuesOutToTenantRows() {
        CveMetadata metadata = meta();
        TenantCve row = TenantCve.builder().cveId(CVE).tenantId("t1").build();
        when(nvdClient.fetch(CVE)).thenReturn(new NvdCveData(5.0, "MEDIUM", PUBLISHED, "d", "CWE-1"));
        when(epssClient.fetch(any())).thenReturn(Map.of(CVE, 0.1));
        when(cisaKevClient.knownExploitedCves()).thenReturn(Set.of());
        when(tenantCveRepository.findByCveId(CVE)).thenReturn(List.of(row));

        service(true, true, true).enrich(List.of(metadata));

        assertThat(row.getSeverity()).isEqualTo("MEDIUM");
        assertThat(row.getCvssScore()).isEqualTo(5.0);
        assertThat(row.getEpssProbability()).isEqualTo(0.1);
        assertThat(row.getPublishedAt()).isEqualTo(PUBLISHED);
        assertThat(row.getUpdatedAt()).isNotNull();
        verify(tenantCveRepository).saveAll(List.of(row));
    }

    @Test
    void enrich_withNvdDisabled_neverCallsNvdAndLeavesNvdFieldsNull() {
        CveMetadata metadata = meta();
        when(epssClient.fetch(any())).thenReturn(Map.of(CVE, 0.9));
        when(cisaKevClient.knownExploitedCves()).thenReturn(Set.of(CVE));
        when(tenantCveRepository.findByCveId(CVE)).thenReturn(List.of());

        service(false, true, true).enrich(List.of(metadata));

        verifyNoInteractions(nvdClient);
        assertThat(metadata.getCvssScore()).isNull();
        assertThat(metadata.getSeverity()).isNull();
        assertThat(metadata.getEpssProbability()).isEqualTo(0.9);
        assertThat(metadata.getCisaKnownExploit()).isTrue();
    }

    @Test
    void enrich_withEmptyKevSet_doesNotOverwriteExistingFlag() {
        CveMetadata metadata = meta();
        metadata.setCisaKnownExploit(true);
        when(nvdClient.fetch(CVE)).thenReturn(new NvdCveData(1.0, "LOW", PUBLISHED, "d", null));
        when(epssClient.fetch(any())).thenReturn(Map.of());
        when(cisaKevClient.knownExploitedCves()).thenReturn(Set.of());
        when(tenantCveRepository.findByCveId(CVE)).thenReturn(List.of());

        service(true, true, true).enrich(List.of(metadata));

        assertThat(metadata.getCisaKnownExploit()).isTrue();
    }

    @Test
    void enrich_withEmptyInput_isNoOp() {
        service(true, true, true).enrich(List.of());
        verifyNoInteractions(cveMetadataRepository, tenantCveRepository, nvdClient, epssClient, cisaKevClient);
    }

    @Test
    void refreshScores_updatesVolatileSignalsWithoutTouchingNvdOrCacheClock() {
        Instant originalCachedAt = Instant.parse("2023-06-01T00:00:00Z");
        CveMetadata metadata = meta();
        metadata.setCachedAt(originalCachedAt);
        when(epssClient.fetch(any())).thenReturn(Map.of(CVE, 0.55));
        when(tenantCveRepository.findByCveId(CVE)).thenReturn(List.of());

        service(true, true, true).refreshScores(List.of(metadata), Set.of(CVE));

        assertThat(metadata.getEpssProbability()).isEqualTo(0.55);
        assertThat(metadata.getCisaKnownExploit()).isTrue();
        assertThat(metadata.getCachedAt()).isEqualTo(originalCachedAt);   // refresh must not reset the NVD clock
        assertThat(metadata.getLastModifiedAt()).isNotNull();
        verify(cveMetadataRepository).save(metadata);
        verify(nvdClient, never()).fetch(any());
    }
}
