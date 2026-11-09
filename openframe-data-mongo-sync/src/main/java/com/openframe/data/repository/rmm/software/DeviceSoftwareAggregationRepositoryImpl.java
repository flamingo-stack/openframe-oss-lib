package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.document.rmm.software.Software;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationOperation;
import org.springframework.stereotype.Repository;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

// aggregate() is not tenant-scoped by TenantAwareMongoTemplate: every pipeline matches tenantId itself
@Repository
@RequiredArgsConstructor
public class DeviceSoftwareAggregationRepositoryImpl implements DeviceSoftwareAggregationRepository {

    private static final List<Object> NULL_ONLY = Collections.singletonList(null);

    private final MongoTemplate mongoTemplate;

    @Override
    public Optional<SoftwareTitleRollup> rollUpTitle(String tenantId, Long softwareTitleId) {
        List<AggregationOperation> stages = List.of(
                ctx -> new Document("$match", new Document("tenantId", tenantId)
                        .append("softwareTitleId", softwareTitleId)
                        .append("machineConnected", true)),
                ctx -> new Document("$sort", new Document("machineId", 1)),
                ctx -> new Document("$group", new Document("_id", null)
                        .append("devicesCount", new Document("$sum", ifString("$machineId", 1, 0)))
                        .append("name", new Document("$first", "$name"))
                        .append("source", new Document("$first", "$source"))
                        .append("vendors", new Document("$push", nonBlankOrRemove("$vendor")))
                        .append("upgradeCodes", new Document("$push", nonBlankOrRemove("$upgradeCode")))
                        .append("versionLists", new Document("$addToSet", orEmpty("$versions")))
                        .append("cveLists", new Document("$addToSet", orEmpty("$vulnerabilities")))
                        .append("arpKeyLists", new Document("$addToSet", orEmpty("$arpKeys")))
                        .append("packageFamilyNameLists", new Document("$addToSet", orEmpty("$packageFamilyNames")))
                        .append("installerTypeLists", new Document("$addToSet", orEmpty("$installerTypes")))
                        .append("systemComponentReported", new Document("$sum", new Document("$cond",
                                List.of(new Document("$eq", List.of(new Document("$type", "$systemComponent"), "bool")), 1, 0))))
                        .append("systemComponentSet", new Document("$sum", new Document("$cond",
                                List.of(new Document("$eq", List.of("$systemComponent", true)), 1, 0))))
                        // installations[] is still read by the per-device read paths
                        .append("installations", new Document("$push", new Document("machineId", "$machineId")
                                .append("versions", "$versions")))),
                ctx -> new Document("$project", new Document("_id", 0)
                        .append("devicesCount", 1)
                        .append("name", 1)
                        .append("source", 1)
                        .append("installations", 1)
                        .append("systemComponentReported", 1)
                        .append("systemComponentSet", 1)
                        .append("vendor", new Document("$arrayElemAt", List.of("$vendors", 0)))
                        .append("upgradeCode", new Document("$arrayElemAt", List.of("$upgradeCodes", 0)))
                        .append("versions", union("$versionLists"))
                        .append("cveCount", new Document("$size", new Document("$setDifference",
                                List.of(union("$cveLists"), NULL_ONLY))))
                        .append("arpKeys", union("$arpKeyLists"))
                        .append("packageFamilyNames", union("$packageFamilyNameLists"))
                        .append("installerTypes", union("$installerTypeLists"))));
        return Optional.ofNullable(aggregateOne(stages)).map(DeviceSoftwareAggregationRepositoryImpl::toTitleRollup);
    }

    @Override
    public Optional<CveRollup> rollUpCve(String tenantId, String cveId) {
        List<AggregationOperation> stages = List.of(
                ctx -> new Document("$match", new Document("tenantId", tenantId)
                        .append("vulnerabilities", cveId)
                        .append("machineConnected", true)),
                ctx -> new Document("$sort", new Document("machineId", 1)),
                ctx -> new Document("$group", new Document("_id", "$softwareTitleId")
                        .append("machines", new Document("$addToSet", "$machineId"))
                        .append("names", new Document("$push", nonNullOrRemove("$name")))
                        .append("sources", new Document("$push", nonNullOrRemove("$source")))
                        .append("versions", new Document("$push", firstVersionOrRemove()))),
                ctx -> new Document("$sort", new Document("_id", 1)),
                ctx -> new Document("$group", new Document("_id", null)
                        .append("titles", new Document("$push", new Document("softwareTitleId", "$_id")
                                .append("name", new Document("$arrayElemAt", List.of("$names", 0)))
                                .append("source", new Document("$arrayElemAt", List.of("$sources", 0)))
                                .append("installedVersion", new Document("$arrayElemAt", List.of("$versions", 0)))
                                .append("devicesCount", distinctCount("$machines"))))
                        .append("machineSets", new Document("$push", "$machines"))),
                ctx -> new Document("$project", new Document("_id", 0)
                        .append("titles", 1)
                        .append("devicesCount", distinctCount(union("$machineSets")))));
        return Optional.ofNullable(aggregateOne(stages)).map(DeviceSoftwareAggregationRepositoryImpl::toCveRollup);
    }

    private Document aggregateOne(List<AggregationOperation> stages) {
        return mongoTemplate.aggregate(Aggregation.newAggregation(stages), DeviceSoftware.class, Document.class)
                .getUniqueMappedResult();
    }

    private static SoftwareTitleRollup toTitleRollup(Document doc) {
        int reported = intValue(doc.get("systemComponentReported"));
        return new SoftwareTitleRollup(
                intValue(doc.get("devicesCount")),
                doc.getString("name"),
                doc.getString("source"),
                doc.getString("vendor"),
                doc.getString("upgradeCode"),
                strings(doc, "versions"),
                intValue(doc.get("cveCount")),
                strings(doc, "arpKeys"),
                strings(doc, "packageFamilyNames"),
                strings(doc, "installerTypes"),
                reported > 0 && reported == intValue(doc.get("systemComponentSet")),
                doc.getList("installations", Document.class, List.of()).stream()
                        .map(i -> Software.Installation.builder()
                                .machineId(i.getString("machineId"))
                                .versions(i.getList("versions", String.class))
                                .build())
                        .toList());
    }

    private static CveRollup toCveRollup(Document doc) {
        List<CveRollup.Title> titles = doc.getList("titles", Document.class, List.of()).stream()
                .filter(t -> t.get("softwareTitleId") != null)
                .map(t -> new CveRollup.Title(
                        ((Number) t.get("softwareTitleId")).longValue(),
                        t.getString("name"),
                        t.getString("source"),
                        t.getString("installedVersion"),
                        intValue(t.get("devicesCount"))))
                .toList();
        return new CveRollup(intValue(doc.get("devicesCount")), titles);
    }

    // a set union without blanks, sorted so the stored lists do not reorder between projections
    private static List<String> strings(Document doc, String field) {
        return doc.getList(field, String.class, List.of()).stream()
                .filter(StringUtils::isNotBlank)
                .sorted()
                .toList();
    }

    private static int intValue(Object value) {
        return value == null ? 0 : ((Number) value).intValue();
    }

    private static Document union(Object arrayOfArrays) {
        return new Document("$reduce", new Document("input", arrayOfArrays)
                .append("initialValue", List.of())
                .append("in", new Document("$setUnion", List.of("$$value", "$$this"))));
    }

    private static Document distinctCount(Object array) {
        return new Document("$size", new Document("$setDifference", List.of(array, NULL_ONLY)));
    }

    private static Document orEmpty(String field) {
        return new Document("$ifNull", List.of(field, List.of()));
    }

    private static Document ifString(String field, Object then, Object otherwise) {
        return new Document("$cond", List.of(
                new Document("$eq", List.of(new Document("$type", field), "string")), then, otherwise));
    }

    private static Document nonNullOrRemove(String field) {
        return new Document("$cond", List.of(
                new Document("$eq", List.of(new Document("$type", field), "string")), field, "$$REMOVE"));
    }

    private static Document nonBlankOrRemove(String field) {
        Document trimmedLength = new Document("$strLenCP", new Document("$trim",
                new Document("input", new Document("$ifNull", List.of(field, "")))));
        return new Document("$cond", Arrays.asList(new Document("$gt", List.of(trimmedLength, 0)), field, "$$REMOVE"));
    }

    // the first non-null version a machine reports for the title, missing when it reports none
    private static Document firstVersionOrRemove() {
        Document versions = new Document("$filter", new Document("input", orEmpty("$versions"))
                .append("cond", new Document("$ne", Arrays.asList("$$this", null))));
        return new Document("$arrayElemAt", List.of(versions, 0));
    }
}
