package com.openframe.management.osupdate.parser;

import com.openframe.data.document.rmm.osupdate.OsUpdateSeverity;
import com.openframe.management.osupdate.MsrcCvrfBulletin;
import com.openframe.management.osupdate.MsrcKbArticle;
import com.openframe.management.osupdate.parser.MsrcCvrfDocument.MsrcCvrfEntry;
import com.openframe.management.osupdate.parser.MsrcCvrfDocument.MsrcCvrfVulnerability;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.io.InputStream;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;

import static org.apache.commons.lang3.StringUtils.isBlank;
import static org.apache.commons.lang3.StringUtils.isNumeric;

// MSRC CVRF v3.0 JSON, one monthly document.
@Component
@RequiredArgsConstructor
public class MsrcCvrfDocumentParser {

    // CVRF threat and remediation type codes.
    private static final int THREAT_EXPLOIT_STATUS = 1;
    private static final int THREAT_SEVERITY = 3;
    private static final int REMEDIATION_VENDOR_FIX = 2;
    private static final String EXPLOITED_YES = "Exploited:Yes";

    private final ObjectMapper objectMapper;
    private final MsrcWindowsBuildParser msrcWindowsBuildParser;

    public MsrcCvrfBulletin parse(InputStream cvrfDocument) {
        MsrcCvrfDocument msrcCvrfDocument = objectMapper.readValue(cvrfDocument, MsrcCvrfDocument.class);
        KbArticles kbArticles = new KbArticles();
        orEmpty(msrcCvrfDocument.getMsrcCvrfVulnerabilities()).forEach(kbArticles::addVulnerability);
        return MsrcCvrfBulletin.builder()
                .kbArticles(kbArticles.build())
                .latestWindowsBuilds(msrcWindowsBuildParser.parseLatestBuilds(msrcCvrfDocument))
                .build();
    }

    // What the document says so far, per fix KB.
    private static final class KbArticles {

        private final Map<String, Set<String>> cveIdsByKb = new HashMap<>();
        private final Map<String, OsUpdateSeverity> severityByKb = new HashMap<>();
        private final Set<String> exploitedKbs = new HashSet<>();

        // The ratings of a CVE differ per product: only those of the products the KB fixes count.
        private void addVulnerability(MsrcCvrfVulnerability msrcCvrfVulnerability) {
            String cveId = msrcCvrfVulnerability.getCve();
            if (isBlank(cveId)) {
                return;
            }
            List<MsrcCvrfEntry> threats = orEmpty(msrcCvrfVulnerability.getThreats());
            boolean exploited = threats.stream()
                    .filter(threat -> isOfType(threat, THREAT_EXPLOIT_STATUS))
                    .anyMatch(threat -> descriptionOf(threat).contains(EXPLOITED_YES));
            for (MsrcCvrfEntry remediation : orEmpty(msrcCvrfVulnerability.getRemediations())) {
                String kb = descriptionOf(remediation).trim();
                if (!isOfType(remediation, REMEDIATION_VENDOR_FIX) || !isNumeric(kb)) {
                    continue;
                }
                cveIdsByKb.computeIfAbsent(kb, key -> new TreeSet<>()).add(cveId);
                Set<String> productIds = productIdsOf(remediation);
                maxSeverity(threats, productIds)
                        .ifPresent(severity -> severityByKb.merge(kb, severity, MsrcCvrfDocumentParser::moreSevere));
                if (exploited) {
                    exploitedKbs.add(kb);
                }
            }
        }

        private Map<String, MsrcKbArticle> build() {
            Map<String, MsrcKbArticle> kbArticles = new HashMap<>();
            cveIdsByKb.forEach((kb, cveIds) -> kbArticles.put(kb, MsrcKbArticle.builder()
                    .kbArticleId(kb)
                    .cveIds(List.copyOf(cveIds))
                    .severity(severityByKb.get(kb))
                    .exploited(exploitedKbs.contains(kb))
                    .build()));
            return kbArticles;
        }
    }

    private static Optional<OsUpdateSeverity> maxSeverity(List<MsrcCvrfEntry> threats, Set<String> productIds) {
        return threats.stream()
                .filter(threat -> isOfType(threat, THREAT_SEVERITY))
                .filter(threat -> appliesTo(threat, productIds))
                .map(threat -> toSeverity(descriptionOf(threat)))
                .flatMap(Optional::stream)
                .reduce(MsrcCvrfDocumentParser::moreSevere);
    }

    private static Optional<OsUpdateSeverity> toSeverity(String rating) {
        try {
            return Optional.of(OsUpdateSeverity.valueOf(rating.trim().toUpperCase(Locale.ROOT)));
        } catch (IllegalArgumentException unknownRating) {
            return Optional.empty();
        }
    }

    // Declared from the most severe down.
    private static OsUpdateSeverity moreSevere(OsUpdateSeverity first, OsUpdateSeverity second) {
        return first.ordinal() <= second.ordinal() ? first : second;
    }

    // No product list = the entry is about every product of the CVE.
    private static boolean appliesTo(MsrcCvrfEntry msrcCvrfEntry, Set<String> productIds) {
        Set<String> entryProductIds = productIdsOf(msrcCvrfEntry);
        return entryProductIds.isEmpty() || entryProductIds.stream().anyMatch(productIds::contains);
    }

    private static boolean isOfType(MsrcCvrfEntry msrcCvrfEntry, int type) {
        return Objects.equals(msrcCvrfEntry.getType(), type);
    }

    private static String descriptionOf(MsrcCvrfEntry msrcCvrfEntry) {
        MsrcCvrfDocument.MsrcCvrfDescription msrcCvrfDescription = msrcCvrfEntry.getMsrcCvrfDescription();
        if (msrcCvrfDescription == null || msrcCvrfDescription.getValue() == null) {
            return "";
        }
        return msrcCvrfDescription.getValue();
    }

    private static Set<String> productIdsOf(MsrcCvrfEntry msrcCvrfEntry) {
        return new HashSet<>(orEmpty(msrcCvrfEntry.getProductIds()));
    }

    private static <T> List<T> orEmpty(List<T> list) {
        return Objects.requireNonNullElse(list, List.of());
    }
}
