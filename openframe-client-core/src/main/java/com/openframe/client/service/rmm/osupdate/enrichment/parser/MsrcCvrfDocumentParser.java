package com.openframe.client.service.rmm.osupdate.enrichment.parser;

import com.openframe.client.service.rmm.osupdate.enrichment.MsrcKbArticle;
import com.openframe.data.document.rmm.osupdate.OsUpdateSeverity;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.core.JsonParser;
import tools.jackson.core.JsonToken;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.InputStream;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Pattern;
import java.util.stream.StreamSupport;

// MSRC CVRF v3.0 JSON, one monthly document. Read one vulnerability at a time: a document is about 20 MB.
@Component
@RequiredArgsConstructor
public class MsrcCvrfDocumentParser {

    private static final String VULNERABILITY = "Vulnerability";
    private static final int THREAT_EXPLOIT_STATUS = 1;
    private static final int THREAT_SEVERITY = 3;
    private static final int REMEDIATION_VENDOR_FIX = 2;
    private static final String EXPLOITED_YES = "Exploited:Yes";
    private static final Pattern KB_NUMBER = Pattern.compile("\\d+");

    private final ObjectMapper objectMapper;

    public Map<String, MsrcKbArticle> parse(InputStream cvrfDocument) {
        Map<String, Set<String>> cveIdsByKb = new HashMap<>();
        Map<String, Double> cvssScoreByKb = new HashMap<>();
        Map<String, OsUpdateSeverity> severityByKb = new HashMap<>();
        Set<String> exploitedKbs = new HashSet<>();
        try (JsonParser jsonParser = objectMapper.createParser(cvrfDocument)) {
            expect(jsonParser.nextToken(), JsonToken.START_OBJECT);
            while (jsonParser.nextToken() == JsonToken.PROPERTY_NAME) {
                String propertyName = jsonParser.currentName();
                JsonToken valueToken = jsonParser.nextToken();
                if (VULNERABILITY.equals(propertyName) && valueToken == JsonToken.START_ARRAY) {
                    while (jsonParser.nextToken() == JsonToken.START_OBJECT) {
                        JsonNode vulnerability = jsonParser.readValueAsTree();
                        addVulnerability(vulnerability, cveIdsByKb, cvssScoreByKb, severityByKb, exploitedKbs);
                    }
                } else {
                    jsonParser.skipChildren();
                }
            }
        }
        Map<String, MsrcKbArticle> kbArticles = new HashMap<>();
        cveIdsByKb.forEach((kb, cveIds) -> kbArticles.put(kb, MsrcKbArticle.builder()
                .kbArticleId(kb)
                .cveIds(List.copyOf(cveIds))
                .severity(severityByKb.get(kb))
                .cvssScore(cvssScoreByKb.get(kb))
                .exploited(exploitedKbs.contains(kb))
                .build()));
        return kbArticles;
    }

    private static void expect(JsonToken actual, JsonToken expected) {
        if (actual != expected) {
            throw new IllegalArgumentException("CVRF document must be a JSON object, got " + actual);
        }
    }

    // The scores and ratings of a CVE differ per product: only those of the products the KB fixes count.
    private static void addVulnerability(JsonNode vulnerability, Map<String, Set<String>> cveIdsByKb,
                                         Map<String, Double> cvssScoreByKb,
                                         Map<String, OsUpdateSeverity> severityByKb, Set<String> exploitedKbs) {
        String cveId = vulnerability.path("CVE").asString("");
        if (cveId.isBlank()) {
            return;
        }
        JsonNode threats = vulnerability.path("Threats");
        boolean exploited = elements(threats).stream()
                .filter(threat -> threat.path("Type").asInt(-1) == THREAT_EXPLOIT_STATUS)
                .anyMatch(threat -> threat.path("Description").path("Value").asString("").contains(EXPLOITED_YES));
        JsonNode remediations = vulnerability.path("Remediations");
        for (JsonNode remediation : elements(remediations)) {
            String kb = remediation.path("Description").path("Value").asString("").trim();
            if (remediation.path("Type").asInt(-1) != REMEDIATION_VENDOR_FIX || !KB_NUMBER.matcher(kb).matches()) {
                continue;
            }
            Set<String> productIds = productIds(remediation);
            cveIdsByKb.computeIfAbsent(kb, key -> new TreeSet<>()).add(cveId);
            maxCvssScore(vulnerability, productIds)
                    .ifPresent(score -> cvssScoreByKb.merge(kb, score, Math::max));
            maxSeverity(vulnerability, productIds)
                    .ifPresent(severity -> severityByKb.merge(kb, severity, MsrcCvrfDocumentParser::moreSevere));
            if (exploited) {
                exploitedKbs.add(kb);
            }
        }
    }

    private static Optional<Double> maxCvssScore(JsonNode vulnerability, Set<String> productIds) {
        JsonNode cvssScoreSets = vulnerability.path("CVSSScoreSets");
        return elements(cvssScoreSets).stream()
                .filter(scoreSet -> appliesTo(scoreSet, productIds))
                .map(scoreSet -> scoreSet.path("BaseScore"))
                .filter(JsonNode::isNumber)
                .map(JsonNode::asDouble)
                .max(Double::compare);
    }

    private static Optional<OsUpdateSeverity> maxSeverity(JsonNode vulnerability, Set<String> productIds) {
        JsonNode threats = vulnerability.path("Threats");
        return elements(threats).stream()
                .filter(threat -> threat.path("Type").asInt(-1) == THREAT_SEVERITY)
                .filter(threat -> appliesTo(threat, productIds))
                .map(threat -> toSeverity(threat.path("Description").path("Value").asString("")))
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
    private static boolean appliesTo(JsonNode entry, Set<String> productIds) {
        Set<String> entryProductIds = productIds(entry);
        return entryProductIds.isEmpty() || entryProductIds.stream().anyMatch(productIds::contains);
    }

    private static Set<String> productIds(JsonNode entry) {
        Set<String> productIds = new HashSet<>();
        JsonNode entryProductIds = entry.path("ProductID");
        elements(entryProductIds).forEach(productId -> productIds.add(productId.asString("")));
        return productIds;
    }

    private static List<JsonNode> elements(JsonNode array) {
        return StreamSupport.stream(array.spliterator(), false).toList();
    }
}
