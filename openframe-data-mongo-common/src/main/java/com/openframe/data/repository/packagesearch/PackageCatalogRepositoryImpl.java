package com.openframe.data.repository.packagesearch;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.FindAndReplaceOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationExpression;
import org.springframework.data.mongodb.core.aggregation.AggregationOperation;
import org.springframework.data.mongodb.core.aggregation.AggregationOptions;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.aggregation.ArrayOperators;
import org.springframework.data.mongodb.core.aggregation.ComparisonOperators;
import org.springframework.data.mongodb.core.aggregation.ConditionalOperators;
import org.springframework.data.mongodb.core.aggregation.ConditionalOperators.Switch.CaseOperator;
import org.springframework.data.mongodb.core.aggregation.ConvertOperators;
import org.springframework.data.mongodb.core.aggregation.CountOperation;
import org.springframework.data.mongodb.core.aggregation.LiteralOperators;
import org.springframework.data.mongodb.core.aggregation.StringOperators;
import org.springframework.data.mongodb.core.query.Collation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.function.Function;

import static org.springframework.data.mongodb.core.aggregation.Aggregation.ROOT;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.addFields;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.count;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.facet;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.limit;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.match;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.newAggregation;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.project;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.sort;
import static org.springframework.data.mongodb.core.query.Criteria.where;
import static org.springframework.util.StringUtils.hasText;

@Slf4j
@RequiredArgsConstructor
public class PackageCatalogRepositoryImpl implements PackageCatalogRepositoryCustom {

    private static final String NAME = "name";
    private static final String PACKAGE_ID = "packageId";
    private static final String POPULARITY = "popularity";
    private static final String SCORE = "score";
    private static final String POPULARITY_OR_ZERO = "popularityOrZero";
    private static final String HITS = "hits";
    private static final String ENTRY = "entry";
    private static final String CURSOR = "cursor";
    private static final String TOTAL = "total";
    private static final String COUNT = "n";
    private static final String HAS_MORE = "hasMore";
    private static final String CURSOR_SEPARATOR = "|";
    private static final int EXACT = 3;
    private static final int PREFIX = 2;
    private static final int CONTAINS = 1;
    private static final int NO_MATCH = 0;
    private static final Collation CASE_INSENSITIVE = Collation.of("en").strength(2);

    private static final Ordering MOST_POPULAR_FIRST = new Ordering(
            Sort.by(Sort.Order.desc(SCORE), Sort.Order.desc(POPULARITY_OR_ZERO), Sort.Order.asc(PACKAGE_ID)),
            POPULARITY_OR_ZERO, Sort.Direction.DESC, Integer::valueOf);
    private static final Ordering BY_NAME = new Ordering(
            Sort.by(Sort.Order.desc(SCORE), Sort.Order.asc(NAME), Sort.Order.asc(PACKAGE_ID)),
            NAME, Sort.Direction.ASC, secondary -> secondary);

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
        AggregationOperation scored = scoreByName(nameQuery);
        AggregationOperation matched = match(matchedOnly);
        AggregationOperation ranked = sort(ordering.getSort());
        AggregationOperation page = pageWithTotal(ordering, afterCursor, limit);
        AggregationOperation shaped = shapePage(limit);
        AggregationOptions options = AggregationOptions.builder().collation(CASE_INSENSITIVE).build();
        Aggregation aggregation = newAggregation(ofManager, scored, matched, ranked, page, shaped)
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

    // exact 3 > prefix 2 > contains 1; $indexOfCP ignores the collation, hence $toLower;
    // the query goes in as a $literal so that "$name" typed by a user stays a string
    private static AggregationOperation scoreByName(String nameQuery) {
        String lowerCaseQuery = nameQuery.toLowerCase(Locale.ROOT);
        AggregationExpression query = LiteralOperators.valueOf(lowerCaseQuery).asLiteral();
        AggregationExpression lowerName = StringOperators.valueOf(NAME).toLower();
        AggregationExpression position = StringOperators.valueOf(lowerName).indexOfCP(query);
        AggregationExpression isExact = ComparisonOperators.valueOf(lowerName).equalTo(query);
        AggregationExpression isPrefix = ComparisonOperators.valueOf(position).equalToValue(0);
        AggregationExpression isContained = ComparisonOperators.valueOf(position).greaterThanValue(0);
        CaseOperator exact = CaseOperator.when(isExact).then(EXACT);
        CaseOperator prefix = CaseOperator.when(isPrefix).then(PREFIX);
        CaseOperator contains = CaseOperator.when(isContained).then(CONTAINS);
        AggregationExpression score = ConditionalOperators.switchCases(exact, prefix, contains).defaultTo(NO_MATCH);
        AggregationExpression popularityOrZero = ConditionalOperators.ifNull(POPULARITY).then(0);
        return addFields()
                .addFieldWithValue(SCORE, score)
                .addFieldWithValue(POPULARITY_OR_ZERO, popularityOrZero)
                .build();
    }

    // total counts every match; only the hits branch is cut at the cursor, one row past the limit for hasMore
    private static AggregationOperation pageWithTotal(Ordering ordering, String afterCursor, int limit) {
        List<AggregationOperation> hitStages = new ArrayList<>();
        afterCursor(ordering, afterCursor).ifPresent(hitStages::add);
        hitStages.add(limit(limit + 1L));
        hitStages.add(ordering.hitProjection());
        AggregationOperation[] hits = hitStages.toArray(AggregationOperation[]::new);
        CountOperation countAll = count().as(COUNT);
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
        AggregationExpression firstHits = ArrayOperators.arrayOf(HITS).slice().itemCount(limit);
        AggregationExpression hitCount = ArrayOperators.arrayOf(HITS).length();
        AggregationExpression hasMore = ComparisonOperators.valueOf(hitCount).greaterThanValue(limit);
        AggregationExpression firstTotal = ArrayOperators.arrayOf(TOTAL + "." + COUNT).first();
        AggregationExpression totalOrZero = ConditionalOperators.ifNull(firstTotal).then(0);
        return project()
                .and(firstHits).as(HITS)
                .and(totalOrZero).as(TOTAL)
                .and(hasMore).as(HAS_MORE);
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
            AggregationExpression scoreText = ConvertOperators.valueOf(SCORE).convertToString();
            AggregationExpression secondaryText = ConvertOperators.valueOf(secondaryField).convertToString();
            AggregationExpression cursor = StringOperators.valueOf(scoreText)
                    .concat(CURSOR_SEPARATOR)
                    .concatValueOf(PACKAGE_ID)
                    .concat(CURSOR_SEPARATOR)
                    .concatValueOf(secondaryText);
            return project()
                    .and(ROOT).as(ENTRY)
                    .and(cursor).as(CURSOR);
        }
    }
}
