package com.openframe.data.repository.packagesearch;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.function.Function;

import static org.springframework.data.mongodb.core.aggregation.Aggregation.count;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.facet;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.limit;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.match;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.newAggregation;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.sort;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.stage;
import static org.springframework.data.mongodb.core.query.Criteria.where;
import static org.springframework.util.StringUtils.hasText;

@Slf4j
@RequiredArgsConstructor
public class PackageCatalogRepositoryImpl implements PackageCatalogRepositoryCustom {

    private static final String QUERY = "query";
    private static final String SCORE = "score";
    private static final String POPULARITY_OR_ZERO = "popularityOrZero";
    private static final String NAME = "name";
    private static final String PACKAGE_ID = "packageId";
    private static final String HITS = "hits";
    private static final String TOTAL = "total";
    private static final String HAS_MORE = "hasMore";
    private static final String CURSOR_SEPARATOR = "|";
    private static final int NO_MATCH = 0;
    private static final Collation CASE_INSENSITIVE = Collation.of("en").strength(2);

    // exact 3 > prefix 2 > contains 1; $indexOfCP ignores the collation, hence $toLower
    private static final String SCORE_BY_NAME_STAGE = """
            { "$set": {
                "popularityOrZero": { "$ifNull": [ "$popularity", 0 ] },
                "score": { "$switch": {
                    "branches": [
                        { "case": { "$eq": [ { "$toLower": "$name" }, "$query" ] }, "then": 3 },
                        { "case": { "$eq": [ { "$indexOfCP": [ { "$toLower": "$name" }, "$query" ] }, 0 ] }, "then": 2 },
                        { "case": { "$gt": [ { "$indexOfCP": [ { "$toLower": "$name" }, "$query" ] }, 0 ] }, "then": 1 } ],
                    "default": 0 } } } }
            """;

    private static final Ordering MOST_POPULAR_FIRST = new Ordering(
            Sort.by(Sort.Order.desc(SCORE), Sort.Order.desc(POPULARITY_OR_ZERO), Sort.Order.asc(PACKAGE_ID)),
            POPULARITY_OR_ZERO, Sort.Direction.DESC, new Document("$toString", "$" + POPULARITY_OR_ZERO), Integer::valueOf);
    private static final Ordering BY_NAME = new Ordering(
            Sort.by(Sort.Order.desc(SCORE), Sort.Order.asc(NAME), Sort.Order.asc(PACKAGE_ID)),
            NAME, Sort.Direction.ASC, "$" + NAME, secondary -> secondary);

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
    public PackageCatalogPage searchByName(PackageManagerType manager, String nameQuery, PackageCatalogOrder order,
                                           String afterCursor, int limit) {
        Ordering ordering = orderingOf(order);
        Criteria byManager = where("manager").is(manager);
        Criteria matchedOnly = where(SCORE).gt(NO_MATCH);

        AggregationOperation ofManager = match(byManager);
        AggregationOperation withQuery = withQuery(nameQuery);
        AggregationOperation scored = stage(SCORE_BY_NAME_STAGE);
        AggregationOperation matched = match(matchedOnly);
        AggregationOperation ranked = sort(ordering.getSort());
        AggregationOperation page = pageWithTotal(ordering, afterCursor, limit);
        AggregationOperation shaped = shapePage(limit);
        AggregationOptions options = AggregationOptions.builder().collation(CASE_INSENSITIVE).build();
        Aggregation aggregation = newAggregation(ofManager, withQuery, scored, matched, ranked, page, shaped)
                .withOptions(options);

        AggregationResults<PackageCatalogPage> results =
                mongoTemplate.aggregate(aggregation, PackageCatalogEntry.class, PackageCatalogPage.class);
        return results.getUniqueMappedResult();
    }

    private static Ordering orderingOf(PackageCatalogOrder order) {
        return switch (order) {
            case MOST_POPULAR_FIRST -> MOST_POPULAR_FIRST;
            case BY_NAME -> BY_NAME;
        };
    }

    // $literal keeps a query like "$name" a string instead of a field path
    private static AggregationOperation withQuery(String nameQuery) {
        String lowerCaseQuery = nameQuery.toLowerCase(Locale.ROOT);
        Document literalQuery = new Document("$literal", lowerCaseQuery);
        Document queryField = new Document(QUERY, literalQuery);
        Document setQuery = new Document("$set", queryField);
        return stage(setQuery);
    }

    // total counts every match; only the hits branch is cut at the cursor, one row past the limit for hasMore
    private static AggregationOperation pageWithTotal(Ordering ordering, String afterCursor, int limit) {
        List<AggregationOperation> hitStages = new ArrayList<>();
        afterCursor(ordering, afterCursor).ifPresent(hitStages::add);
        hitStages.add(limit(limit + 1L));
        hitStages.add(ordering.hitProjection());
        AggregationOperation[] hits = hitStages.toArray(AggregationOperation[]::new);
        CountOperation countAll = count().as("n");
        return facet(hits).as(HITS).and(countAll).as(TOTAL);
    }

    private static Optional<AggregationOperation> afterCursor(Ordering ordering, String afterCursor) {
        if (!hasText(afterCursor)) {
            return Optional.empty();
        }
        try {
            CursorKey key = parseCursor(afterCursor);
            Criteria afterKey = ordering.after(key);
            return Optional.of(match(afterKey));
        } catch (IllegalArgumentException e) {
            log.warn("Invalid package catalog cursor '{}', serving the first page", afterCursor);
            return Optional.empty();
        }
    }

    // "score|packageId|secondary": a packageId never contains '|', a name may, so the secondary is the tail
    private static CursorKey parseCursor(String rawCursor) {
        int afterScore = rawCursor.indexOf(CURSOR_SEPARATOR);
        int afterPackageId = afterScore < 0 ? -1 : rawCursor.indexOf(CURSOR_SEPARATOR, afterScore + 1);
        if (afterPackageId < 0) {
            throw new IllegalArgumentException("cursor must be score|packageId|secondary");
        }
        int score = Integer.parseInt(rawCursor.substring(0, afterScore));
        String packageId = rawCursor.substring(afterScore + 1, afterPackageId);
        String secondary = rawCursor.substring(afterPackageId + 1);
        return new CursorKey(score, packageId, secondary);
    }

    private static AggregationOperation shapePage(int limit) {
        Document hitsSize = new Document("$size", "$" + HITS);
        Document hasMore = new Document("$gt", List.of(hitsSize, limit));
        Document hits = new Document("$slice", List.of("$" + HITS, limit));
        Document firstTotal = new Document("$first", "$" + TOTAL + ".n");
        Document totalOrZero = new Document("$ifNull", List.of(firstTotal, 0));
        Document shape = new Document(HITS, hits).append(TOTAL, totalOrZero).append(HAS_MORE, hasMore);
        Document project = new Document("$project", shape);
        return stage(project);
    }

    @Getter
    @AllArgsConstructor
    private static final class CursorKey {
        private final int score;
        private final String packageId;
        private final String secondary;
    }

    // score desc, then the manager's secondary key, then packageId asc; the cursor carries all three
    @Getter
    @AllArgsConstructor
    private static final class Ordering {
        private final Sort sort;
        private final String secondaryField;
        private final Sort.Direction secondaryDirection;
        private final Object secondaryCursorExpression;
        private final Function<String, Object> secondaryParser;

        private Criteria after(CursorKey key) {
            Object secondary = secondaryParser.apply(key.getSecondary());
            Criteria lowerScore = where(SCORE).lt(key.getScore());
            Criteria sameScore = where(SCORE).is(key.getScore()).and(secondaryField);
            Criteria laterSecondary = secondaryAfter(sameScore, secondary);
            Criteria laterPackageId = where(SCORE).is(key.getScore())
                    .and(secondaryField).is(secondary)
                    .and(PACKAGE_ID).gt(key.getPackageId());
            return new Criteria().orOperator(lowerScore, laterSecondary, laterPackageId);
        }

        private Criteria secondaryAfter(Criteria secondaryCriteria, Object value) {
            if (isDescending()) {
                return secondaryCriteria.lt(value);
            }
            return secondaryCriteria.gt(value);
        }

        private boolean isDescending() {
            return secondaryDirection == Sort.Direction.DESC;
        }

        private AggregationOperation hitProjection() {
            Document scoreAsString = new Document("$toString", "$" + SCORE);
            List<Object> cursorParts = List.of(scoreAsString, CURSOR_SEPARATOR, "$" + PACKAGE_ID, CURSOR_SEPARATOR, secondaryCursorExpression);
            Document cursor = new Document("$concat", cursorParts);
            Document hit = new Document("entry", "$$ROOT").append("cursor", cursor);
            Document project = new Document("$project", hit);
            return stage(project);
        }
    }
}
