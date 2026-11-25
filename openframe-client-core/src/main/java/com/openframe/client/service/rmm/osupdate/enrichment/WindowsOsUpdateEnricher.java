package com.openframe.client.service.rmm.osupdate.enrichment;

import com.openframe.client.metrics.OsUpdateEnrichmentMetrics;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// MSRC bulletin of the update's month by KB, plus the CISA KEV catalog. Only security updates are in MSRC: a preview,
// a driver or an update without a month is checked and stays without data.
@Component
@ConditionalOnProperty(name = {"openframe.rmm.os-update.enabled", "openframe.rmm.os-update.enrichment.enabled"},
        havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class WindowsOsUpdateEnricher implements OsUpdateEnricher {

    // "2026-11 Cumulative Update for ..." names the Patch Tuesday month of the bulletin.
    private static final Pattern TITLE_MONTH = Pattern.compile("^(\\d{4})-(\\d{2})\\b");
    private static final String KB_PREFIX = "KB";

    private final MsrcCvrfClient msrcCvrfClient;
    private final CisaKevClient cisaKevClient;
    private final OsUpdateEnrichmentMetrics osUpdateEnrichmentMetrics;

    @Override
    public boolean applicableTo(OsUpdate osUpdate) {
        return osUpdate.getPlatform() == OsPlatform.WINDOWS;
    }

    @Override
    public void enrich(List<OsUpdate> osUpdates, Instant enrichedAt) {
        Set<String> knownExploitedCveIds = findKnownExploitedCveIds().orElse(null);
        Map<Optional<YearMonth>, List<OsUpdate>> osUpdatesByMonth = new LinkedHashMap<>();
        osUpdates.forEach(osUpdate -> osUpdatesByMonth
                .computeIfAbsent(bulletinMonth(osUpdate), month -> new ArrayList<>())
                .add(osUpdate));
        Map<Optional<YearMonth>, Map<String, MsrcKbArticle>> kbArticlesByMonth = new LinkedHashMap<>();
        osUpdatesByMonth.keySet().forEach(month ->
                findKbArticles(month.orElse(null)).ifPresent(kbArticles -> kbArticlesByMonth.put(month, kbArticles)));
        Map<String, Set<String>> supersedingKbsByKb = findSupersedingKbsByKb(kbArticlesByMonth.values());
        kbArticlesByMonth.forEach((month, kbArticles) -> osUpdatesByMonth.get(month).forEach(osUpdate ->
                enrich(osUpdate, kbArticles, supersedingKbsByKb, knownExploitedCveIds, enrichedAt)));
    }

    // Only the months of this run: a KB is shown superseded once an update of a later month is enriched with it.
    private static Map<String, Set<String>> findSupersedingKbsByKb(Collection<Map<String, MsrcKbArticle>> months) {
        Map<String, Set<String>> supersedingKbsByKb = new HashMap<>();
        months.forEach(kbArticles -> kbArticles.values().forEach(kbArticle ->
                Objects.requireNonNullElse(kbArticle.getSupersededKbArticleIds(), List.<String>of())
                        .forEach(supersededKb -> supersedingKbsByKb
                                .computeIfAbsent(supersededKb, key -> new TreeSet<>())
                                .add(kbArticle.getKbArticleId()))));
        return supersedingKbsByKb;
    }

    // Empty = KEV unavailable this run; it is asked again when the entry's TTL runs out.
    private Optional<Set<String>> findKnownExploitedCveIds() {
        try {
            return Optional.of(cisaKevClient.getKnownExploitedCveIds());
        } catch (OsUpdateSourceUnavailableException failure) {
            recordSourceFailed(failure);
            return Optional.empty();
        }
    }

    // month is null for an update without a bulletin month: checked, no MSRC data.
    private Optional<Map<String, MsrcKbArticle>> findKbArticles(YearMonth month) {
        if (month == null) {
            return Optional.of(Map.of());
        }
        try {
            return Optional.of(msrcCvrfClient.getKbArticles(month));
        } catch (OsUpdateSourceUnavailableException failure) {
            recordSourceFailed(failure);
            return Optional.empty();
        }
    }

    private void recordSourceFailed(OsUpdateSourceUnavailableException failure) {
        log.warn("OS update enrichment source {} failed, its updates wait for the next run: {}",
                failure.getOsUpdateSource(), failure.getMessage());
        osUpdateEnrichmentMetrics.recordSourceFailed(failure.getOsUpdateSource());
    }

    // MSRC is authoritative for the CVEs, rating and score of a KB it lists; without MSRC data the stored ones stay.
    // knownExploitedCveIds is null when KEV was unavailable this run.
    private void enrich(OsUpdate osUpdate, Map<String, MsrcKbArticle> kbArticles,
                        Map<String, Set<String>> supersedingKbsByKb,
                        Set<String> knownExploitedCveIds, Instant enrichedAt) {
        List<String> kbNumbers = Objects.requireNonNullElse(osUpdate.getKbArticleIds(), List.<String>of())
                .stream()
                .map(WindowsOsUpdateEnricher::toKbNumber)
                .toList();
        Set<String> supersedingKbs = new TreeSet<>();
        kbNumbers.forEach(kbNumber -> supersedingKbs.addAll(supersedingKbsByKb.getOrDefault(kbNumber, Set.of())));
        if (!supersedingKbs.isEmpty()) {
            osUpdate.setSupersededBy(List.copyOf(supersedingKbs));
        }
        List<MsrcKbArticle> matchedKbArticles = kbNumbers.stream()
                .map(kbArticles::get)
                .filter(Objects::nonNull)
                .toList();
        if (!matchedKbArticles.isEmpty()) {
            Set<String> cveIds = new TreeSet<>();
            matchedKbArticles.forEach(kbArticle -> cveIds.addAll(kbArticle.getCveIds()));
            osUpdate.setCveIds(List.copyOf(cveIds));
            matchedKbArticles.stream()
                    .map(MsrcKbArticle::getSeverity)
                    .filter(Objects::nonNull)
                    .min(Enum::compareTo)
                    .ifPresent(osUpdate::setSeverity);
            matchedKbArticles.stream()
                    .map(MsrcKbArticle::getCvssScore)
                    .filter(Objects::nonNull)
                    .max(Double::compare)
                    .ifPresent(osUpdate::setCvssScore);
        }
        boolean exploitedByMsrc = matchedKbArticles.stream().anyMatch(MsrcKbArticle::isExploited);
        List<String> cveIds = Objects.requireNonNullElse(osUpdate.getCveIds(), List.of());
        if (exploitedByMsrc || !cveIds.isEmpty()) {
            // Without KEV a flag KEV set earlier must not drop
            boolean exploitedByKev = knownExploitedCveIds == null
                    ? Boolean.TRUE.equals(osUpdate.getExploited())
                    : cveIds.stream().anyMatch(knownExploitedCveIds::contains);
            osUpdate.setExploited(exploitedByMsrc || exploitedByKev);
        }
        osUpdate.setEnrichedAt(enrichedAt);
        if (matchedKbArticles.isEmpty()) {
            osUpdateEnrichmentMetrics.recordNoData(osUpdate.getPlatform());
        } else {
            osUpdateEnrichmentMetrics.recordEnriched(osUpdate.getPlatform());
        }
    }

    private static Optional<YearMonth> bulletinMonth(OsUpdate osUpdate) {
        if (osUpdate.getDisplayName() != null) {
            Matcher titleMonth = TITLE_MONTH.matcher(osUpdate.getDisplayName().trim());
            if (titleMonth.find()) {
                int month = Integer.parseInt(titleMonth.group(2));
                if (month >= 1 && month <= 12) {
                    return Optional.of(YearMonth.of(Integer.parseInt(titleMonth.group(1)), month));
                }
            }
        }
        return Optional.ofNullable(osUpdate.getPublishedAt())
                .map(publishedAt -> YearMonth.from(publishedAt.atZone(ZoneOffset.UTC)));
    }

    private static String toKbNumber(String kbArticleId) {
        String trimmed = kbArticleId.trim();
        return trimmed.regionMatches(true, 0, KB_PREFIX, 0, KB_PREFIX.length())
                ? trimmed.substring(KB_PREFIX.length())
                : trimmed;
    }
}
