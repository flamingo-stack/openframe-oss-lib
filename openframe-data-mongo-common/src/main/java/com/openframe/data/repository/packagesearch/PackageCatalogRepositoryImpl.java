package com.openframe.data.repository.packagesearch;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.FindAndReplaceOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationOperation;
import org.springframework.data.mongodb.core.aggregation.AggregationOptions;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.aggregation.CountOperation;
import org.springframework.data.mongodb.core.query.Collation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;
import java.util.Locale;

import static org.springframework.data.mongodb.core.aggregation.Aggregation.count;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.facet;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.limit;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.match;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.newAggregation;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.skip;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.sort;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.stage;
import static org.springframework.data.mongodb.core.query.Criteria.where;

@RequiredArgsConstructor
public class PackageCatalogRepositoryImpl implements PackageCatalogRepositoryCustom {

    private static final String QUERY = "query";
    private static final String SCORE = "score";
    private static final String ENTRIES = "entries";
    private static final String TOTAL = "total";
    private static final int NO_MATCH = 0;
    private static final Collation CASE_INSENSITIVE = Collation.of("en").strength(2);

    // exact 3 > prefix 2 > contains 1; $indexOfCP ignores the collation, hence $toLower
    private static final String SCORE_BY_NAME_STAGE = """
            { "$set": { "score": { "$switch": {
                "branches": [
                    { "case": { "$eq": [ { "$toLower": "$name" }, "$query" ] }, "then": 3 },
                    { "case": { "$eq": [ { "$indexOfCP": [ { "$toLower": "$name" }, "$query" ] }, 0 ] }, "then": 2 },
                    { "case": { "$gt": [ { "$indexOfCP": [ { "$toLower": "$name" }, "$query" ] }, 0 ] }, "then": 1 } ],
                "default": 0 } } } }
            """;
    private static final String TOTAL_AS_NUMBER_STAGE = """
            { "$project": { "entries": 1, "total": { "$ifNull": [ { "$first": "$total.n" }, 0 ] } } }
            """;

    private final MongoTemplate mongoTemplate;

    @Override
    public void upsertAll(List<PackageCatalogEntry> entries) {
        BulkOperations bulk = mongoTemplate.bulkOps(BulkOperations.BulkMode.UNORDERED, PackageCatalogEntry.class);
        for (PackageCatalogEntry entry : entries) {
            Query byId = new Query(Criteria.where("_id").is(entry.getId()));
            bulk.replaceOne(byId, entry, FindAndReplaceOptions.options().upsert());
        }
        bulk.execute();
    }

    // an empty query is a prefix of every name, so the same pipeline lists the whole catalog
    @Override
    public PackageCatalogPage searchByName(PackageManagerType manager, String nameQuery, Sort tieBreak, int offset, int limit) {
        Criteria byManager = where("manager").is(manager);
        Criteria matchedOnly = where(SCORE).gt(NO_MATCH);
        Sort bestFirst = Sort.by(Sort.Order.desc(SCORE)).and(tieBreak);

        AggregationOperation ofManager = match(byManager);
        AggregationOperation withQuery = withQuery(nameQuery);
        AggregationOperation scored = stage(SCORE_BY_NAME_STAGE);
        AggregationOperation matched = match(matchedOnly);
        AggregationOperation ranked = sort(bestFirst);
        AggregationOperation page = pageWithTotal(offset, limit);
        AggregationOperation shaped = stage(TOTAL_AS_NUMBER_STAGE);
        AggregationOptions options = AggregationOptions.builder().collation(CASE_INSENSITIVE).build();
        Aggregation aggregation = newAggregation(ofManager, withQuery, scored, matched, ranked, page, shaped)
                .withOptions(options);

        AggregationResults<PackageCatalogPage> results =
                mongoTemplate.aggregate(aggregation, PackageCatalogEntry.class, PackageCatalogPage.class);
        return results.getUniqueMappedResult();
    }

    // $literal keeps a query like "$name" a string instead of a field path
    private static AggregationOperation withQuery(String nameQuery) {
        String lowerCaseQuery = nameQuery.toLowerCase(Locale.ROOT);
        Document literalQuery = new Document("$literal", lowerCaseQuery);
        Document queryField = new Document(QUERY, literalQuery);
        Document setQuery = new Document("$set", queryField);
        return stage(setQuery);
    }

    private static AggregationOperation pageWithTotal(int offset, int limit) {
        AggregationOperation skipOffset = skip((long) offset);
        AggregationOperation takeLimit = limit(limit);
        CountOperation countAll = count().as("n");
        return facet(skipOffset, takeLimit).as(ENTRIES).and(countAll).as(TOTAL);
    }
}
