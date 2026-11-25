package com.openframe.client.service.rmm.osupdate.enrichment;

import com.openframe.client.metrics.OsUpdateEnrichmentMetrics;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateSeverity;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WindowsOsUpdateEnricherTest {

    private static final Instant ENRICHED_AT = Instant.parse("2026-11-25T10:25:00Z");
    private static final YearMonth NOVEMBER = YearMonth.of(2026, 11);
    private static final YearMonth OCTOBER = YearMonth.of(2026, 10);
    private static final MsrcKbArticle NOVEMBER_CUMULATIVE = MsrcKbArticle.builder()
            .kbArticleId("5132061")
            .cveIds(List.of("CVE-2026-113766", "CVE-2026-96157"))
            .severity(OsUpdateSeverity.IMPORTANT)
            .cvssScore(9.8)
            .exploited(false)
            .build();
    private static final MsrcKbArticle OCTOBER_CUMULATIVE = MsrcKbArticle.builder()
            .kbArticleId("5126868")
            .cveIds(List.of("CVE-2026-96951"))
            .severity(OsUpdateSeverity.IMPORTANT)
            .cvssScore(8.8)
            .exploited(true)
            .build();

    @Mock private MsrcCvrfClient msrcCvrfClient;
    @Mock private CisaKevClient cisaKevClient;
    @Mock private OsUpdateEnrichmentMetrics osUpdateEnrichmentMetrics;

    @InjectMocks private WindowsOsUpdateEnricher enricher;

    @Test
    void applicableTo_windowsOnly() {
        // execution / verifications
        assertThat(enricher.applicableTo(osUpdate(OsPlatform.WINDOWS, "x", List.of()))).isTrue();
        assertThat(enricher.applicableTo(osUpdate(OsPlatform.MACOS, "x", List.of()))).isFalse();
    }

    @Test
    void enrich_securityUpdateOfTheMonth_cvesScoreRatingAndCheckedAt() {
        // setup
        OsUpdate cumulative = osUpdate(OsPlatform.WINDOWS,
                "2026-11 Cumulative Update for Windows 11, version 25H2 for x64-based Systems (KB5132061)",
                List.of("KB5132061"));
        when(cisaKevClient.getKnownExploitedCveIds()).thenReturn(Set.of("CVE-2026-124194"));
        when(msrcCvrfClient.getKbArticles(NOVEMBER)).thenReturn(Map.of("5132061", NOVEMBER_CUMULATIVE));

        // execution
        enricher.enrich(List.of(cumulative), ENRICHED_AT);

        // verifications
        assertThat(cumulative.getCveIds()).containsExactly("CVE-2026-113766", "CVE-2026-96157");
        assertThat(cumulative.getSeverity()).isEqualTo(OsUpdateSeverity.IMPORTANT);
        assertThat(cumulative.getCvssScore()).isEqualTo(9.8);
        assertThat(cumulative.getExploited()).isFalse();
        assertThat(cumulative.getEnrichedAt()).isEqualTo(ENRICHED_AT);
        verify(osUpdateEnrichmentMetrics).recordEnriched(OsPlatform.WINDOWS);
    }

    @Test
    void enrich_deviceReportedOtherCvesAndRating_replacedByMsrc() {
        // setup
        OsUpdate cumulative = osUpdate(OsPlatform.WINDOWS, "2026-11 Cumulative Update (KB5132061)", List.of("5132061"));
        cumulative.setCveIds(List.of("CVE-2026-124194"));
        cumulative.setSeverity(OsUpdateSeverity.CRITICAL);
        when(cisaKevClient.getKnownExploitedCveIds()).thenReturn(Set.of("CVE-2026-124194"));
        when(msrcCvrfClient.getKbArticles(NOVEMBER)).thenReturn(Map.of("5132061", NOVEMBER_CUMULATIVE));

        // execution
        enricher.enrich(List.of(cumulative), ENRICHED_AT);

        // verifications
        assertThat(cumulative.getCveIds()).containsExactly("CVE-2026-113766", "CVE-2026-96157");
        assertThat(cumulative.getSeverity()).isEqualTo(OsUpdateSeverity.IMPORTANT);
        assertThat(cumulative.getExploited()).isFalse();
    }

    @Test
    void enrich_noMsrcDataForTheKb_deviceReportedCvesAndRatingKept() {
        // setup
        OsUpdate preview = osUpdate(OsPlatform.WINDOWS, "2026-11 Cumulative Update Preview (KB5132057)", List.of("5132057"));
        preview.setCveIds(List.of("CVE-2026-124194"));
        preview.setSeverity(OsUpdateSeverity.CRITICAL);
        when(cisaKevClient.getKnownExploitedCveIds()).thenReturn(Set.of("CVE-2026-124194"));
        when(msrcCvrfClient.getKbArticles(NOVEMBER)).thenReturn(Map.of("5132061", NOVEMBER_CUMULATIVE));

        // execution
        enricher.enrich(List.of(preview), ENRICHED_AT);

        // verifications
        assertThat(preview.getCveIds()).containsExactly("CVE-2026-124194");
        assertThat(preview.getSeverity()).isEqualTo(OsUpdateSeverity.CRITICAL);
        assertThat(preview.getExploited()).isTrue();
    }

    @Test
    void enrich_exploitedByMsrc_exploitedWithoutKev() {
        // setup
        OsUpdate cumulative = osUpdate(OsPlatform.WINDOWS, "2026-10 Cumulative Update (KB5126868)", List.of("5126868"));
        when(cisaKevClient.getKnownExploitedCveIds()).thenReturn(Set.of());
        when(msrcCvrfClient.getKbArticles(OCTOBER)).thenReturn(Map.of("5126868", OCTOBER_CUMULATIVE));

        // execution
        enricher.enrich(List.of(cumulative), ENRICHED_AT);

        // verifications
        assertThat(cumulative.getExploited()).isTrue();
    }

    @Test
    void enrich_previewNotInTheBulletin_checkedWithoutData() {
        // setup
        OsUpdate preview = osUpdate(OsPlatform.WINDOWS,
                "2026-11 Cumulative Update Preview for Windows 11 (KB5132057)", List.of("5132057"));
        when(cisaKevClient.getKnownExploitedCveIds()).thenReturn(Set.of());
        when(msrcCvrfClient.getKbArticles(NOVEMBER)).thenReturn(Map.of("5132061", NOVEMBER_CUMULATIVE));

        // execution
        enricher.enrich(List.of(preview), ENRICHED_AT);

        // verifications
        assertThat(preview.getEnrichedAt()).isEqualTo(ENRICHED_AT);
        assertThat(preview.getCveIds()).isEmpty();
        assertThat(preview.getCvssScore()).isNull();
        assertThat(preview.getExploited()).isNull();
        verify(osUpdateEnrichmentMetrics).recordNoData(OsPlatform.WINDOWS);
    }

    @Test
    void enrich_titleWithoutMonth_monthOfPublication() {
        // setup
        OsUpdate cumulative = osUpdate(OsPlatform.WINDOWS, "Security Update (KB5132061)", List.of("5132061"));
        cumulative.setPublishedAt(Instant.parse("2026-11-10T18:00:00Z"));
        when(cisaKevClient.getKnownExploitedCveIds()).thenReturn(Set.of());
        when(msrcCvrfClient.getKbArticles(NOVEMBER)).thenReturn(Map.of("5132061", NOVEMBER_CUMULATIVE));

        // execution
        enricher.enrich(List.of(cumulative), ENRICHED_AT);

        // verifications
        assertThat(cumulative.getCvssScore()).isEqualTo(9.8);
    }

    @Test
    void enrich_noMonthAtAll_checkedWithoutAskingMsrc() {
        // setup
        OsUpdate driver = osUpdate(OsPlatform.WINDOWS, "Intel - Display - 31.0.101.5590", List.of());
        when(cisaKevClient.getKnownExploitedCveIds()).thenReturn(Set.of());

        // execution
        enricher.enrich(List.of(driver), ENRICHED_AT);

        // verifications
        assertThat(driver.getEnrichedAt()).isEqualTo(ENRICHED_AT);
        verify(msrcCvrfClient, never()).getKbArticles(any());
    }

    @Test
    void enrich_msrcMonthFails_itsUpdatesWaitOthersEnriched() {
        // setup
        OsUpdate november = osUpdate(OsPlatform.WINDOWS, "2026-11 Cumulative Update (KB5132061)", List.of("5132061"));
        OsUpdate october = osUpdate(OsPlatform.WINDOWS, "2026-10 Cumulative Update (KB5126868)", List.of("5126868"));
        when(cisaKevClient.getKnownExploitedCveIds()).thenReturn(Set.of());
        when(msrcCvrfClient.getKbArticles(NOVEMBER))
                .thenThrow(new OsUpdateSourceUnavailableException(OsUpdateSource.MSRC_CVRF, "timed out"));
        when(msrcCvrfClient.getKbArticles(OCTOBER)).thenReturn(Map.of("5126868", OCTOBER_CUMULATIVE));

        // execution
        enricher.enrich(List.of(november, october), ENRICHED_AT);

        // verifications
        assertThat(november.getEnrichedAt()).isNull();
        assertThat(november.getCvssScore()).isNull();
        assertThat(october.getEnrichedAt()).isEqualTo(ENRICHED_AT);
        verify(osUpdateEnrichmentMetrics).recordSourceFailed(OsUpdateSource.MSRC_CVRF);
    }

    @Test
    void enrich_kevFails_enrichedFromMsrcOnly() {
        // setup
        OsUpdate cumulative = osUpdate(OsPlatform.WINDOWS, "2026-10 Cumulative Update (KB5126868)", List.of("5126868"));
        when(cisaKevClient.getKnownExploitedCveIds())
                .thenThrow(new OsUpdateSourceUnavailableException(OsUpdateSource.CISA_KEV, "503"));
        when(msrcCvrfClient.getKbArticles(OCTOBER)).thenReturn(Map.of("5126868", OCTOBER_CUMULATIVE));

        // execution
        enricher.enrich(List.of(cumulative), ENRICHED_AT);

        // verifications
        assertThat(cumulative.getCveIds()).containsExactly("CVE-2026-96951");
        assertThat(cumulative.getCvssScore()).isEqualTo(8.8);
        assertThat(cumulative.getExploited()).isTrue();
        assertThat(cumulative.getEnrichedAt()).isEqualTo(ENRICHED_AT);
        verify(osUpdateEnrichmentMetrics).recordSourceFailed(OsUpdateSource.CISA_KEV);
    }

    @Test
    void enrich_kevFailsForAnUpdateKevHadFlagged_staysExploited() {
        // setup
        OsUpdate cumulative = osUpdate(OsPlatform.WINDOWS, "2026-11 Cumulative Update (KB5132061)", List.of("5132061"));
        cumulative.setCveIds(List.of("CVE-2026-96157"));
        cumulative.setExploited(true);
        when(cisaKevClient.getKnownExploitedCveIds())
                .thenThrow(new OsUpdateSourceUnavailableException(OsUpdateSource.CISA_KEV, "503"));
        when(msrcCvrfClient.getKbArticles(NOVEMBER)).thenReturn(Map.of("5132061", NOVEMBER_CUMULATIVE));

        // execution
        enricher.enrich(List.of(cumulative), ENRICHED_AT);

        // verifications
        assertThat(cumulative.getExploited()).isTrue();
    }

    private static OsUpdate osUpdate(OsPlatform platform, String displayName, List<String> kbArticleIds) {
        return OsUpdate.builder()
                .platform(platform)
                .identifier(displayName)
                .displayName(displayName)
                .kbArticleIds(kbArticleIds)
                .cveIds(List.of())
                .build();
    }
}
