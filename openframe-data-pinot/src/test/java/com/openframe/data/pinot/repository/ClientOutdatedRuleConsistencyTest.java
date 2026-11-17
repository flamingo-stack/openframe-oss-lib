package com.openframe.data.pinot.repository;

import com.openframe.data.config.ClientVersionThreshold;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.filter.DeviceFacetDimension;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import com.openframe.data.repository.device.CustomMachineRepositoryImpl;
import org.apache.pinot.client.Connection;
import org.apache.pinot.client.ResultSet;
import org.apache.pinot.client.ResultSetGroup;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Query;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// One key table run through every implementation of "outdated": the threshold bean (GraphQL, External API), the Mongo
// filter, facet buckets and rank sort, and the Pinot filter conditions. A row must land on the same side everywhere.
@ExtendWith(MockitoExtension.class)
class ClientOutdatedRuleConsistencyTest {

    private static final String TENANT_ID = "tenant-1";
    private static final long THRESHOLD_KEY = 1_000_006_000_000L;
    private static final long FAR_BELOW_KEY = 9_000_000L;
    private static final long FAR_ABOVE_KEY = 99_000_000_000_000L;
    // schema-devices.json defaultNullValue of agentVersionKey: what a row without a key holds when null handling is off
    private static final long PINOT_NULL_DEFAULT = -1L;
    private static final String RANK_FIELD = "_clientOutdatedRank";
    private static final String KEY_FIELD = "agentVersionKey";
    private static final Pattern PINOT_KEY_CONDITION = Pattern.compile("\\((agentVersionKey [^()]*)\\)");
    private static final Pattern PINOT_ATOM = Pattern.compile("agentVersionKey (<|<=|>|>=|=) (-?\\d+)");

    @Mock private Connection pinotConnection;
    @Mock private ResultSetGroup resultSetGroup;
    @Mock private ResultSet resultSet;
    @Mock private MongoTemplate mongoTemplate;
    @Captor private ArgumentCaptor<String> sqlCaptor;
    @Captor private ArgumentCaptor<Query> queryCaptor;
    @Captor private ArgumentCaptor<Aggregation> aggregationCaptor;

    private final ClientVersionThreshold threshold = new ClientVersionThreshold("1.6.0");
    private PinotClientDeviceRepository pinotRepository;
    private CustomMachineRepositoryImpl mongoRepository;

    @BeforeEach
    void setUp() throws Exception {
        pinotRepository = new PinotClientDeviceRepository(pinotConnection, threshold);
        Field devicesTable = PinotClientDeviceRepository.class.getDeclaredField("devicesTable");
        devicesTable.setAccessible(true);
        devicesTable.set(pinotRepository, "devices");
        mongoRepository = new CustomMachineRepositoryImpl(mongoTemplate, threshold);
    }

    @ParameterizedTest
    @MethodSource("keyTable")
    void isOutdated_keyTable_matchesExpectedSide(Long agentVersionKey, boolean outdated) {
        // execution
        boolean result = threshold.isOutdated(agentVersionKey);

        // verifications
        assertEquals(outdated, result);
    }

    @ParameterizedTest
    @MethodSource("keyTable")
    void mongoRankSort_keyTable_ranksOnTheExpectedSide(Long agentVersionKey, boolean outdated) {
        // setup
        ObjectId cursorId = new ObjectId();
        Machine cursorDoc = new Machine();
        cursorDoc.setId(cursorId.toHexString());
        cursorDoc.setAgentVersionKey(agentVersionKey);
        when(mongoTemplate.findById(cursorId, Machine.class)).thenReturn(cursorDoc);
        List<Document> rows = List.of();
        AggregationResults<Document> results = new AggregationResults<>(rows, new Document());
        when(mongoTemplate.aggregate(any(Aggregation.class), eq(Machine.class), eq(Document.class))).thenReturn(results);
        MachineQueryFilter filter = MachineQueryFilter.builder().build();

        // execution
        mongoRepository.findMachinesWithCursor(TENANT_ID, filter, null, cursorId.toHexString(), 10,
                "clientOutdated", "DESC");

        // verifications
        verify(mongoTemplate).aggregate(aggregationCaptor.capture(), eq(Machine.class), eq(Document.class));
        List<Document> stages = aggregationCaptor.getValue().toPipeline(Aggregation.DEFAULT_CONTEXT);
        Document sameRankPastId = stages.get(2).get("$match", Document.class).getList("$or", Document.class).getLast();
        assertEquals(outdated ? 1 : 0, sameRankPastId.get(RANK_FIELD));
    }

    @ParameterizedTest
    @MethodSource("keyTable")
    void mongoFacetBuckets_keyTable_rowInExactlyTheExpectedBucket(Long agentVersionKey, boolean outdated) {
        // setup
        when(mongoTemplate.count(any(Query.class), eq(Machine.class))).thenReturn(0L, 0L);
        MachineQueryFilter filter = MachineQueryFilter.builder().build();

        // execution
        mongoRepository.facet(TENANT_ID, filter, null, DeviceFacetDimension.CLIENT_OUTDATED);

        // verifications
        verify(mongoTemplate, times(2)).count(queryCaptor.capture(), eq(Machine.class));
        Document outdatedBucket = queryCaptor.getAllValues().getFirst().getQueryObject().getList("$and", Document.class).getLast();
        Document notOutdatedBucket = queryCaptor.getAllValues().getLast().getQueryObject().getList("$and", Document.class).getLast();
        boolean inOutdated = mongoMatches(outdatedBucket, agentVersionKey);
        boolean inNotOutdated = mongoMatches(notOutdatedBucket, agentVersionKey);
        assertNotEquals(inOutdated, inNotOutdated, "a row must land in exactly one bucket");
        assertEquals(outdated, inOutdated);
    }

    @ParameterizedTest
    @MethodSource("keyTable")
    void pinotConditions_keyTable_rowInExactlyTheExpectedBucket(Long agentVersionKey, boolean outdated) {
        // setup
        stubEmptyPinotCounts();

        // execution
        Map<String, Integer> buckets = pinotRepository.getClientOutdatedFilterOptions(TENANT_ID, List.of(), List.of(),
                List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of());

        // verifications
        assertEquals(List.of("true", "false"), List.copyOf(buckets.keySet()));
        verify(pinotConnection, times(2)).execute(sqlCaptor.capture());
        String outdatedCondition = keyCondition(sqlCaptor.getAllValues().getFirst());
        String notOutdatedCondition = keyCondition(sqlCaptor.getAllValues().getLast());
        assertTrue(outdatedCondition.contains(Long.toString(THRESHOLD_KEY)), outdatedCondition);
        assertTrue(notOutdatedCondition.contains(Long.toString(THRESHOLD_KEY)), notOutdatedCondition);
        assertBucket(outdatedCondition, notOutdatedCondition, agentVersionKey, outdated, false);
        assertBucket(outdatedCondition, notOutdatedCondition, agentVersionKey, outdated, true);
    }

    private static Stream<Arguments> keyTable() {
        return Stream.of(
                Arguments.of(null, false),
                Arguments.of(FAR_BELOW_KEY, true),
                Arguments.of(THRESHOLD_KEY - 1, true),
                Arguments.of(THRESHOLD_KEY, false),
                Arguments.of(THRESHOLD_KEY + 1, false),
                Arguments.of(FAR_ABOVE_KEY, false));
    }

    private void stubEmptyPinotCounts() {
        when(pinotConnection.execute(anyString())).thenReturn(resultSetGroup);
        when(resultSetGroup.getResultSet(0)).thenReturn(resultSet);
        when(resultSet.getRowCount()).thenReturn(0);
    }

    private static void assertBucket(String outdatedCondition, String notOutdatedCondition, Long agentVersionKey,
                                     boolean outdated, boolean queryNullHandling) {
        boolean inOutdated = pinotMatches(outdatedCondition, agentVersionKey, queryNullHandling);
        boolean inNotOutdated = pinotMatches(notOutdatedCondition, agentVersionKey, queryNullHandling);
        String mode = "query null handling " + queryNullHandling;
        assertNotEquals(inOutdated, inNotOutdated, "a row must land in exactly one bucket, " + mode);
        assertEquals(outdated, inOutdated, mode);
    }

    private static String keyCondition(String sql) {
        Matcher matcher = PINOT_KEY_CONDITION.matcher(sql);
        assertTrue(matcher.find(), sql);
        return matcher.group(1);
    }

    // Off: a missing key reads as the column default and IS NULL uses the null vector. On: any comparison with null is
    // unknown, which a WHERE drops, and only IS NULL holds.
    private static boolean pinotMatches(String condition, Long agentVersionKey, boolean queryNullHandling) {
        return Stream.of(condition.split(" OR "))
                .anyMatch(conjunction -> Stream.of(conjunction.split(" AND "))
                        .allMatch(atom -> pinotAtomMatches(atom.trim(), agentVersionKey, queryNullHandling)));
    }

    private static boolean pinotAtomMatches(String atom, Long agentVersionKey, boolean queryNullHandling) {
        if (atom.equals(KEY_FIELD + " IS NULL")) {
            return agentVersionKey == null;
        }
        if (agentVersionKey == null && queryNullHandling) {
            return false;
        }
        long stored = agentVersionKey == null ? PINOT_NULL_DEFAULT : agentVersionKey;
        Matcher matcher = PINOT_ATOM.matcher(atom);
        assertTrue(matcher.matches(), atom);
        long bound = Long.parseLong(matcher.group(2));
        return compare(stored, matcher.group(1), bound);
    }

    // The Mongo shapes the repository builds: {$or: [...]}, {key: null} (null or missing), {key: {$op: bound}} (numbers only)
    private static boolean mongoMatches(Document clause, Long agentVersionKey) {
        if (clause.containsKey("$or")) {
            return clause.getList("$or", Document.class).stream()
                    .anyMatch(branch -> mongoMatches(branch, agentVersionKey));
        }
        Object condition = clause.get(KEY_FIELD);
        if (condition == null) {
            return agentVersionKey == null;
        }
        if (agentVersionKey == null) {
            return false;
        }
        Document operators = (Document) condition;
        return operators.entrySet().stream()
                .allMatch(operator -> compare(agentVersionKey, mongoOperator(operator.getKey()),
                        ((Number) operator.getValue()).longValue()));
    }

    private static String mongoOperator(String operator) {
        return switch (operator) {
            case "$lt" -> "<";
            case "$lte" -> "<=";
            case "$gt" -> ">";
            case "$gte" -> ">=";
            default -> throw new IllegalArgumentException("unexpected operator " + operator);
        };
    }

    private static boolean compare(long value, String operator, long bound) {
        return switch (operator) {
            case "<" -> value < bound;
            case "<=" -> value <= bound;
            case ">" -> value > bound;
            case ">=" -> value >= bound;
            case "=" -> value == bound;
            default -> throw new IllegalArgumentException("unexpected operator " + operator);
        };
    }
}
