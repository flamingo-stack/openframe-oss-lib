package com.openframe.data.pinot.repository;

import com.openframe.data.pinot.model.LogProjection;
import com.openframe.data.pinot.model.LogSortPosition;
import com.openframe.data.pinot.model.OrganizationOption;
import com.openframe.data.pinot.repository.exception.PinotQueryException;
import org.apache.pinot.client.Connection;
import org.apache.pinot.client.ResultSet;
import org.apache.pinot.client.ResultSetGroup;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PinotClientLogRepositoryTest {

    private static final String TENANT_ID = "uuid-aaa";
    private static final LocalDate START = LocalDate.of(2026, 1, 1);
    private static final LocalDate END = LocalDate.of(2026, 1, 31);

    @Mock
    private Connection pinotConnection;

    @Mock
    private ResultSetGroup resultSetGroup;

    @Mock
    private ResultSet resultSet;

    private PinotClientLogRepository repository;

    @BeforeEach
    void setUp() throws Exception {
        repository = new PinotClientLogRepository(pinotConnection);
        setField(repository, "logsTable", "logs");
    }

    private static void setField(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }

    @Nested
    @DisplayName("tenantId propagation")
    class TenantIdPropagation {

        @Test
        @DisplayName("findLogs throws when tenantId is null (builder validation)")
        void findLogsThrowsOnNullTenant() {
            assertThrows(PinotQueryException.class, () ->
                    repository.findLogs(null, START, END, null, null, List.of(), List.of(), List.of(),
                            List.of(), null, null, 100, "eventTimestamp", "DESC", false));
        }

        @Test
        @DisplayName("findLogs throws when tenantId is blank (builder validation)")
        void findLogsThrowsOnBlankTenant() {
            assertThrows(PinotQueryException.class, () ->
                    repository.findLogs("  ", START, END, null, null, List.of(), List.of(), List.of(),
                            List.of(), null, null, 100, "eventTimestamp", "DESC", false));
        }

        @Test
        @DisplayName("findLogs query contains tenantId filter")
        void findLogsIncludesTenantId() {
            whenQueryReturnsEmptyRows();
            repository.findLogs(TENANT_ID, START, END, null, null, List.of(), List.of(), List.of(),
                    List.of(), null, null, 100, "eventTimestamp", "DESC", false);
            String query = captureExecutedQuery();
            assertTrue(query.contains("tenantId = 'uuid-aaa'"),
                    "findLogs query missing tenantId filter: " + query);
        }

        @Test
        @DisplayName("searchLogs query contains tenantId filter")
        void searchLogsIncludesTenantId() {
            whenQueryReturnsEmptyRows();
            repository.searchLogs(TENANT_ID, START, END, null, null, List.of(), List.of(), List.of(),
                    List.of(), null, "term", null, 100, "eventTimestamp", "DESC", false);
            assertTrue(captureExecutedQuery().contains("tenantId = 'uuid-aaa'"));
        }

        @Test
        @DisplayName("getEventTypeOptions query contains tenantId filter")
        void getEventTypeOptionsIncludesTenantId() {
            whenQueryReturnsEmptyRows();
            repository.getEventTypeOptions(TENANT_ID, START, END, List.of(), List.of(), List.of(), List.of());
            assertTrue(captureExecutedQuery().contains("tenantId = 'uuid-aaa'"));
        }

        @Test
        @DisplayName("getSeverityOptions query contains tenantId filter")
        void getSeverityOptionsIncludesTenantId() {
            whenQueryReturnsEmptyRows();
            repository.getSeverityOptions(TENANT_ID, START, END, List.of(), List.of(), List.of(), List.of());
            assertTrue(captureExecutedQuery().contains("tenantId = 'uuid-aaa'"));
        }

        @Test
        @DisplayName("getToolTypeOptions query contains tenantId filter")
        void getToolTypeOptionsIncludesTenantId() {
            whenQueryReturnsEmptyRows();
            repository.getToolTypeOptions(TENANT_ID, START, END, List.of(), List.of(), List.of(), List.of());
            assertTrue(captureExecutedQuery().contains("tenantId = 'uuid-aaa'"));
        }

        @Test
        @DisplayName("getAvailableDateRanges query contains tenantId filter")
        void getAvailableDateRangesIncludesTenantId() {
            whenQueryReturnsEmptyRows();
            repository.getAvailableDateRanges(TENANT_ID, List.of(), List.of(), List.of(), List.of());
            assertTrue(captureExecutedQuery().contains("tenantId = 'uuid-aaa'"));
        }

        @Test
        @DisplayName("getOrganizationOptions query contains tenantId filter")
        void getOrganizationOptionsIncludesTenantId() {
            whenQueryReturnsEmptyRows();
            repository.getOrganizationOptions(TENANT_ID, START, END, List.of(), List.of(), List.of());
            assertTrue(captureExecutedQuery().contains("tenantId = 'uuid-aaa'"));
        }
    }

    @Nested
    @DisplayName("sort validation")
    class SortValidation {

        @Test
        @DisplayName("isSortableField accepts known columns")
        void acceptsSortableField() {
            assertTrue(repository.isSortableField("eventTimestamp"));
            assertTrue(repository.isSortableField("severity"));
        }

        @Test
        @DisplayName("isSortableField rejects unknown columns")
        void rejectsUnknownField() {
            assertEquals(false, repository.isSortableField("randomField"));
        }

        @Test
        @DisplayName("isSortableField rejects null / blank")
        void rejectsNullOrBlank() {
            assertEquals(false, repository.isSortableField(null));
            assertEquals(false, repository.isSortableField("  "));
        }

        @Test
        @DisplayName("default sort field is eventTimestamp")
        void defaultSortField() {
            assertEquals("eventTimestamp", repository.getDefaultSortField());
        }
    }

    @Nested
    @DisplayName("result mapping")
    class ResultMapping {

        @Test
        @DisplayName("findLogs maps ResultSet rows to LogProjection objects")
        void mapsLogProjection() {
            // 13 columns as declared in findLogs: toolEventId, ingestDay, toolType, eventType, severity,
            // userId, deviceId, hostname, nickname, organizationId, organizationName, summary, eventTimestamp
            when(pinotConnection.execute(anyString())).thenReturn(resultSetGroup);
            when(resultSetGroup.getResultSet(0)).thenReturn(resultSet);
            when(resultSet.getRowCount()).thenReturn(1);
            when(resultSet.getColumnCount()).thenReturn(13);
            when(resultSet.getColumnName(0)).thenReturn("toolEventId");
            when(resultSet.getColumnName(1)).thenReturn("ingestDay");
            when(resultSet.getColumnName(2)).thenReturn("toolType");
            when(resultSet.getColumnName(3)).thenReturn("eventType");
            when(resultSet.getColumnName(4)).thenReturn("severity");
            when(resultSet.getColumnName(5)).thenReturn("userId");
            when(resultSet.getColumnName(6)).thenReturn("deviceId");
            when(resultSet.getColumnName(7)).thenReturn("hostname");
            when(resultSet.getColumnName(8)).thenReturn("nickname");
            when(resultSet.getColumnName(9)).thenReturn("organizationId");
            when(resultSet.getColumnName(10)).thenReturn("organizationName");
            when(resultSet.getColumnName(11)).thenReturn("summary");
            when(resultSet.getColumnName(12)).thenReturn("eventTimestamp");

            when(resultSet.getString(0, 0)).thenReturn("evt-1");
            when(resultSet.getString(0, 1)).thenReturn("2026-01-15");
            when(resultSet.getString(0, 2)).thenReturn("FLEET_MDM");
            when(resultSet.getString(0, 3)).thenReturn("DEVICE_ONLINE");
            when(resultSet.getString(0, 4)).thenReturn("INFO");
            when(resultSet.getString(0, 5)).thenReturn("user-1");
            when(resultSet.getString(0, 6)).thenReturn("dev-1");
            when(resultSet.getString(0, 7)).thenReturn("host-1");
            when(resultSet.getString(0, 8)).thenReturn("Reception iMac");
            when(resultSet.getString(0, 9)).thenReturn("org-1");
            when(resultSet.getString(0, 10)).thenReturn("Org One");
            when(resultSet.getString(0, 11)).thenReturn("Device came online");
            when(resultSet.getLong(0, 12)).thenReturn(1700000000000L);

            List<LogProjection> result = repository.findLogs(TENANT_ID, START, END, null, null, List.of(), List.of(),
                    List.of(), List.of(), null, null, 100, "eventTimestamp", "DESC", false);

            assertEquals(1, result.size());
            LogProjection p = result.get(0);
            assertEquals("evt-1", p.toolEventId);
            assertEquals("FLEET_MDM", p.toolType);
            assertEquals("INFO", p.severity);
            assertEquals("host-1", p.hostname);
            assertEquals("Reception iMac", p.nickname);
            assertEquals("Org One", p.organizationName);
            assertNotNull(p.eventTimestamp);
        }

        @Test
        @DisplayName("a column missing from the result set degrades to null instead of failing the whole page")
        void missingColumnDoesNotBreakMapping() {
            // Pinot schema not yet caught up with the deployed code: nickname is selected but absent.
            when(pinotConnection.execute(anyString())).thenReturn(resultSetGroup);
            when(resultSetGroup.getResultSet(0)).thenReturn(resultSet);
            when(resultSet.getRowCount()).thenReturn(1);
            when(resultSet.getColumnCount()).thenReturn(12);
            when(resultSet.getColumnName(0)).thenReturn("toolEventId");
            when(resultSet.getColumnName(1)).thenReturn("ingestDay");
            when(resultSet.getColumnName(2)).thenReturn("toolType");
            when(resultSet.getColumnName(3)).thenReturn("eventType");
            when(resultSet.getColumnName(4)).thenReturn("severity");
            when(resultSet.getColumnName(5)).thenReturn("userId");
            when(resultSet.getColumnName(6)).thenReturn("deviceId");
            when(resultSet.getColumnName(7)).thenReturn("hostname");
            when(resultSet.getColumnName(8)).thenReturn("organizationId");
            when(resultSet.getColumnName(9)).thenReturn("organizationName");
            when(resultSet.getColumnName(10)).thenReturn("summary");
            when(resultSet.getColumnName(11)).thenReturn("eventTimestamp");

            when(resultSet.getString(0, 0)).thenReturn("toolEventId-v");
            when(resultSet.getString(0, 1)).thenReturn("ingestDay-v");
            when(resultSet.getString(0, 2)).thenReturn("toolType-v");
            when(resultSet.getString(0, 3)).thenReturn("eventType-v");
            when(resultSet.getString(0, 4)).thenReturn("severity-v");
            when(resultSet.getString(0, 5)).thenReturn("userId-v");
            when(resultSet.getString(0, 6)).thenReturn("deviceId-v");
            when(resultSet.getString(0, 7)).thenReturn("host-1");
            when(resultSet.getString(0, 8)).thenReturn("organizationId-v");
            when(resultSet.getString(0, 9)).thenReturn("organizationName-v");
            when(resultSet.getString(0, 10)).thenReturn("summary-v");
            when(resultSet.getLong(0, 11)).thenReturn(1700000000000L);

            List<LogProjection> result = repository.findLogs(TENANT_ID, START, END, null, null, List.of(), List.of(),
                    List.of(), List.of(), null, null, 100, "eventTimestamp", "DESC", false);

            assertEquals(1, result.size());
            LogProjection p = result.get(0);
            assertEquals("host-1", p.hostname);
            assertNull(p.nickname);
        }

        @Test
        @DisplayName("an empty nickname (the Pinot schema default) maps to null, not an empty string")
        void emptyNicknameMapsToNull() {
            when(pinotConnection.execute(anyString())).thenReturn(resultSetGroup);
            when(resultSetGroup.getResultSet(0)).thenReturn(resultSet);
            when(resultSet.getRowCount()).thenReturn(1);
            when(resultSet.getColumnCount()).thenReturn(13);
            when(resultSet.getColumnName(0)).thenReturn("toolEventId");
            when(resultSet.getColumnName(1)).thenReturn("ingestDay");
            when(resultSet.getColumnName(2)).thenReturn("toolType");
            when(resultSet.getColumnName(3)).thenReturn("eventType");
            when(resultSet.getColumnName(4)).thenReturn("severity");
            when(resultSet.getColumnName(5)).thenReturn("userId");
            when(resultSet.getColumnName(6)).thenReturn("deviceId");
            when(resultSet.getColumnName(7)).thenReturn("hostname");
            when(resultSet.getColumnName(8)).thenReturn("nickname");
            when(resultSet.getColumnName(9)).thenReturn("organizationId");
            when(resultSet.getColumnName(10)).thenReturn("organizationName");
            when(resultSet.getColumnName(11)).thenReturn("summary");
            when(resultSet.getColumnName(12)).thenReturn("eventTimestamp");

            when(resultSet.getString(0, 0)).thenReturn("toolEventId-v");
            when(resultSet.getString(0, 1)).thenReturn("ingestDay-v");
            when(resultSet.getString(0, 2)).thenReturn("toolType-v");
            when(resultSet.getString(0, 3)).thenReturn("eventType-v");
            when(resultSet.getString(0, 4)).thenReturn("severity-v");
            when(resultSet.getString(0, 5)).thenReturn("userId-v");
            when(resultSet.getString(0, 6)).thenReturn("deviceId-v");
            when(resultSet.getString(0, 7)).thenReturn("host-1");
            when(resultSet.getString(0, 8)).thenReturn("");
            when(resultSet.getString(0, 9)).thenReturn("organizationId-v");
            when(resultSet.getString(0, 10)).thenReturn("organizationName-v");
            when(resultSet.getString(0, 11)).thenReturn("summary-v");
            when(resultSet.getLong(0, 12)).thenReturn(1700000000000L);

            List<LogProjection> result = repository.findLogs(TENANT_ID, START, END, null, null, List.of(), List.of(),
                    List.of(), List.of(), null, null, 100, "eventTimestamp", "DESC", false);

            assertEquals("host-1", result.get(0).hostname);
            assertNull(result.get(0).nickname);
        }

        @Test
        @DisplayName("getOrganizationOptions filters null/empty organizationIds")
        void organizationOptionsFilterBlanks() {
            when(pinotConnection.execute(anyString())).thenReturn(resultSetGroup);
            when(resultSetGroup.getResultSet(0)).thenReturn(resultSet);
            when(resultSet.getRowCount()).thenReturn(3);
            // Row 0: valid — both columns are read
            when(resultSet.getString(0, 0)).thenReturn("org-1");
            when(resultSet.getString(0, 1)).thenReturn("Org One");
            // Row 1: null id — filtered out, but organizationName column is still read
            when(resultSet.getString(1, 0)).thenReturn(null);
            when(resultSet.getString(1, 1)).thenReturn(null);
            // Row 2: blank id — filtered out, but organizationName column is still read
            when(resultSet.getString(2, 0)).thenReturn("  ");
            when(resultSet.getString(2, 1)).thenReturn("Should be skipped");

            List<OrganizationOption> result = repository.getOrganizationOptions(
                    TENANT_ID, START, END, List.of(), List.of(), List.of());

            assertEquals(1, result.size());
            assertEquals("org-1", result.get(0).getId());
            assertEquals("Org One", result.get(0).getName());
        }
    }

    @Nested
    @DisplayName("filter options carry an explicit LIMIT")
    class FacetLimits {

        /**
         * Pinot defaults to LIMIT 10 on any query that sets none, so a facet without one returns the first ten
         * values in ORDER BY order and silently drops the rest - the eleventh organization by name is simply
         * missing from the Source filter until another filter narrows the set enough for it to fit.
         */
        @Test
        @DisplayName("every facet query, not just the ones that visibly overflow today")
        void everyFacetQuerySetsALimit() {
            assertLimited(() -> repository.getEventTypeOptions(TENANT_ID, START, END, List.of(), List.of(), List.of(), List.of()));
            assertLimited(() -> repository.getSeverityOptions(TENANT_ID, START, END, List.of(), List.of(), List.of(), List.of()));
            assertLimited(() -> repository.getToolTypeOptions(TENANT_ID, START, END, List.of(), List.of(), List.of(), List.of()));
            assertLimited(() -> repository.getAvailableDateRanges(TENANT_ID, List.of(), List.of(), List.of(), List.of()));
            assertLimited(() -> repository.getOrganizationOptions(TENANT_ID, START, END, List.of(), List.of(), List.of()));
        }

        @Test
        @DisplayName("the ORDER BY stays: the frontend renders the list in the order it receives")
        void keepsTheOrderingAlongsideTheLimit() {
            whenQueryReturnsEmptyRows();

            repository.getOrganizationOptions(TENANT_ID, START, END, List.of(), List.of(), List.of());

            String query = captureExecutedQuery();
            assertTrue(query.indexOf("ORDER BY") < query.indexOf("LIMIT"),
                    () -> "ORDER BY must precede LIMIT, otherwise the limit cuts an unordered set: " + query);
            assertTrue(query.contains("ORDER BY organizationName"), () -> query);
        }

        private void assertLimited(Runnable facetQuery) {
            org.mockito.Mockito.reset(pinotConnection, resultSetGroup, resultSet);
            whenQueryReturnsEmptyRows();

            facetQuery.run();

            String query = captureExecutedQuery();
            assertTrue(query.contains("LIMIT 10000"),
                    () -> "facet query would be truncated to Pinot's default of 10 rows: " + query);
        }
    }

    @Nested
    @DisplayName("keyset paging")
    class KeysetPaging {

        private static final String WHERE_TENANT = " FROM \"logs\" WHERE tenantId = 'uuid-aaa'";
        private static final String SEARCH_CONDITION =
                " AND (TEXT_MATCH(summary, 'term') OR TEXT_MATCH(userId, 'term') OR TEXT_MATCH(nickname, 'term'))";

        @ParameterizedTest
        @MethodSource("com.openframe.data.pinot.repository.PinotClientLogRepositoryTest#keysetQueries")
        void findLogs_positionGiven_seeksPastItAndOrdersInTheFetchDirection(
                String sortField, LogSortPosition position, String sortDirection, boolean backward,
                String expectedKeyset, String expectedOrderBy) {
            // setup
            whenQueryReturnsEmptyRows();

            // execution
            repository.findLogs(TENANT_ID, null, null, null, null, null, null, null, null, null,
                    position, 21, sortField, sortDirection, backward);

            // verifications
            String query = captureExecutedQuery();
            assertTrue(query.endsWith(WHERE_TENANT + " AND " + expectedKeyset + " ORDER BY " + expectedOrderBy + " LIMIT 21"),
                    query);
        }

        @ParameterizedTest
        @MethodSource("com.openframe.data.pinot.repository.PinotClientLogRepositoryTest#keysetQueries")
        void searchLogs_positionGiven_seeksPastItAndOrdersInTheFetchDirection(
                String sortField, LogSortPosition position, String sortDirection, boolean backward,
                String expectedKeyset, String expectedOrderBy) {
            // setup
            whenQueryReturnsEmptyRows();

            // execution
            repository.searchLogs(TENANT_ID, null, null, null, null, null, null, null, null, null, "term",
                    position, 21, sortField, sortDirection, backward);

            // verifications
            String query = captureExecutedQuery();
            assertTrue(query.endsWith(WHERE_TENANT + SEARCH_CONDITION + " AND " + expectedKeyset
                    + " ORDER BY " + expectedOrderBy + " LIMIT 21"), query);
        }

        @ParameterizedTest
        @CsvSource({
                "DESC, false, 'eventTimestamp DESC, toolEventId DESC'",
                "DESC, true,  'eventTimestamp ASC, toolEventId ASC'",
                "ASC,  false, 'eventTimestamp ASC, toolEventId ASC'",
                "ASC,  true,  'eventTimestamp DESC, toolEventId DESC'"
        })
        void findLogs_noPosition_ordersInTheFetchDirectionWithoutAKeyset(
                String sortDirection, boolean backward, String expectedOrderBy) {
            // setup
            whenQueryReturnsEmptyRows();

            // execution
            repository.findLogs(TENANT_ID, null, null, null, null, null, null, null, null, null,
                    null, 21, "eventTimestamp", sortDirection, backward);

            // verifications
            String query = captureExecutedQuery();
            assertTrue(query.endsWith(WHERE_TENANT + " ORDER BY " + expectedOrderBy + " LIMIT 21"), query);
        }

        @ParameterizedTest
        @CsvSource({
                "DESC, false, 'severity DESC, toolEventId DESC'",
                "DESC, true,  'severity ASC, toolEventId ASC'",
                "ASC,  false, 'severity ASC, toolEventId ASC'",
                "ASC,  true,  'severity DESC, toolEventId DESC'"
        })
        void searchLogs_noPosition_ordersInTheFetchDirectionWithoutAKeyset(
                String sortDirection, boolean backward, String expectedOrderBy) {
            // setup
            whenQueryReturnsEmptyRows();

            // execution
            repository.searchLogs(TENANT_ID, null, null, null, null, null, null, null, null, null, "term",
                    null, 21, "severity", sortDirection, backward);

            // verifications
            String query = captureExecutedQuery();
            assertTrue(query.endsWith(WHERE_TENANT + SEARCH_CONDITION + " ORDER BY " + expectedOrderBy + " LIMIT 21"),
                    query);
        }

        @Test
        void findLogs_positionWithEveryFilter_keysetIsOneGroupAfterTheTenantAndEveryFilter() {
            // setup
            whenQueryReturnsEmptyRows();
            LogSortPosition position = LogSortPosition.ofText("INFO", "evt-1");

            // execution
            repository.findLogs(TENANT_ID, null, null, Instant.ofEpochMilli(1000), Instant.ofEpochMilli(2000),
                    List.of("FLEET"), List.of("LOGIN"), List.of("INFO"), List.of("org-1"), "dev-1",
                    position, 21, "severity", "ASC", false);

            // verifications
            String query = captureExecutedQuery();
            assertTrue(query.endsWith(WHERE_TENANT
                    + " AND eventTimestamp >= 1000 AND eventTimestamp <= 2000"
                    + " AND toolType IN ('FLEET') AND eventType IN ('LOGIN') AND severity IN ('INFO')"
                    + " AND organizationId IN ('org-1') AND deviceId = 'dev-1'"
                    + " AND ((severity > 'INFO') OR (severity = 'INFO' AND toolEventId > 'evt-1'))"
                    + " ORDER BY severity ASC, toolEventId ASC LIMIT 21"), query);
        }

        @ParameterizedTest
        @MethodSource("com.openframe.data.pinot.repository.PinotClientLogRepositoryTest#sqlMetacharacterPayloads")
        void findLogs_textPositionWithSqlMetacharacters_valueAndIdWrittenAsEscapedLiterals(String payload, String literal) {
            // setup
            whenQueryReturnsEmptyRows();
            LogSortPosition position = LogSortPosition.ofText(payload, payload);

            // execution
            repository.findLogs(TENANT_ID, null, null, null, null, null, null, null, null, null,
                    position, 21, "severity", "ASC", false);

            // verifications
            String query = captureExecutedQuery();
            assertTrue(query.endsWith(WHERE_TENANT
                    + " AND ((severity > " + literal + ") OR (severity = " + literal + " AND toolEventId > " + literal + "))"
                    + " ORDER BY severity ASC, toolEventId ASC LIMIT 21"), query);
        }

        @ParameterizedTest
        @MethodSource("com.openframe.data.pinot.repository.PinotClientLogRepositoryTest#sqlMetacharacterPayloads")
        void searchLogs_timestampPositionWithSqlMetacharactersInTheId_idWrittenAsAnEscapedLiteral(
                String payload, String literal) {
            // setup
            whenQueryReturnsEmptyRows();
            LogSortPosition position = LogSortPosition.ofTimestamp(1_700_000_000_000L, payload);

            // execution
            repository.searchLogs(TENANT_ID, null, null, null, null, null, null, null, null, null, "term",
                    position, 21, "eventTimestamp", "DESC", false);

            // verifications
            String query = captureExecutedQuery();
            assertTrue(query.endsWith(WHERE_TENANT + SEARCH_CONDITION
                    + " AND ((eventTimestamp < 1700000000000)"
                    + " OR (eventTimestamp = 1700000000000 AND toolEventId < " + literal + "))"
                    + " ORDER BY eventTimestamp DESC, toolEventId DESC LIMIT 21"), query);
        }

        @ParameterizedTest
        @ValueSource(strings = {"summary", "toolEventId", "severity; DROP TABLE logs", "severity DESC, tenantId",
                " severity ", " "})
        void findLogs_sortFieldNotSortable_throwsAndRunsNoQuery(String sortField) {
            // setup
            LogSortPosition position = LogSortPosition.ofText("INFO", "evt-1");

            // execution
            PinotQueryException ex = assertThrows(PinotQueryException.class, () ->
                    repository.findLogs(TENANT_ID, null, null, null, null, null, null, null, null, null,
                            position, 21, sortField, "ASC", false));

            // verifications
            assertEquals("Logs cannot be sorted by the requested field", ex.getMessage());
            verify(pinotConnection, never()).execute(anyString());
        }

        @ParameterizedTest
        @ValueSource(strings = {"summary", "toolEventId", "severity; DROP TABLE logs", "severity DESC, tenantId",
                " severity ", " "})
        void searchLogs_sortFieldNotSortable_throwsAndRunsNoQuery(String sortField) {
            // execution
            PinotQueryException ex = assertThrows(PinotQueryException.class, () ->
                    repository.searchLogs(TENANT_ID, null, null, null, null, null, null, null, null, null, "term",
                            null, 21, sortField, "ASC", false));

            // verifications
            assertEquals("Logs cannot be sorted by the requested field", ex.getMessage());
            verify(pinotConnection, never()).execute(anyString());
        }

        @ParameterizedTest
        @MethodSource("com.openframe.data.pinot.repository.PinotClientLogRepositoryTest#positionsOfTheRow")
        void sortPositionOf_sortableColumn_positionOfTheRowsValueAndToolEventId(String sortField, LogSortPosition expected) {
            // setup
            LogProjection row = row();

            // execution
            LogSortPosition position = repository.sortPositionOf(row, sortField);

            // verifications
            assertEquals(expected, position);
        }

        @Test
        void sortPositionOf_emptyTextValue_positionCarriesTheEmptyString() {
            // setup
            LogProjection row = row();
            row.organizationId = "";

            // execution
            LogSortPosition position = repository.sortPositionOf(row, "organizationId");

            // verifications
            assertEquals(LogSortPosition.ofText("", "evt-1"), position);
        }

        @Test
        void sortPositionOf_sortFieldNotSortable_throws() {
            // setup
            LogProjection row = row();

            // execution
            PinotQueryException ex = assertThrows(PinotQueryException.class, () -> repository.sortPositionOf(row, "summary"));

            // verifications
            assertEquals("Logs cannot be sorted by the requested field", ex.getMessage());
        }

        @ParameterizedTest
        @ValueSource(strings = {"eventTimestamp", "severity", "eventType", "toolType", "organizationId", "deviceId",
                "ingestDay", " severity "})
        void isSortableField_sortableColumn_true(String field) {
            // execution
            boolean sortable = repository.isSortableField(field);

            // verifications
            assertTrue(sortable);
        }

        @ParameterizedTest
        @ValueSource(strings = {"toolEventId", "tenantId", "summary", "userId", "hostname", "severity; DROP TABLE logs"})
        void isSortableField_anyOtherColumn_false(String field) {
            // execution
            boolean sortable = repository.isSortableField(field);

            // verifications
            assertFalse(sortable);
        }
    }

    // ----- helpers -----

    private static Stream<Arguments> keysetQueries() {
        return Stream.of(
                        arguments("eventTimestamp", LogSortPosition.ofTimestamp(1_700_000_000_000L, "evt-1"), "1700000000000"),
                        arguments("severity", LogSortPosition.ofText("INFO", "evt-1"), "'INFO'"),
                        arguments("eventType", LogSortPosition.ofText("LOGIN", "evt-1"), "'LOGIN'"),
                        arguments("toolType", LogSortPosition.ofText("FLEET", "evt-1"), "'FLEET'"),
                        arguments("organizationId", LogSortPosition.ofText("", "evt-1"), "''"),
                        arguments("deviceId", LogSortPosition.ofText("null", "evt-1"), "'null'"),
                        arguments("ingestDay", LogSortPosition.ofText("2026-10-01", "evt-1"), "'2026-10-01'"))
                .flatMap(PinotClientLogRepositoryTest::inEveryDirection);
    }

    private static Stream<Arguments> inEveryDirection(Arguments column) {
        String sortField = (String) column.get()[0];
        LogSortPosition position = (LogSortPosition) column.get()[1];
        String literal = (String) column.get()[2];
        return Stream.of(
                arguments(sortField, position, "ASC", false, keyset(sortField, literal, ">"), orderBy(sortField, "ASC")),
                arguments(sortField, position, "ASC", true, keyset(sortField, literal, "<"), orderBy(sortField, "DESC")),
                arguments(sortField, position, "DESC", false, keyset(sortField, literal, "<"), orderBy(sortField, "DESC")),
                arguments(sortField, position, "DESC", true, keyset(sortField, literal, ">"), orderBy(sortField, "ASC")));
    }

    private static String keyset(String sortField, String literal, String operator) {
        return "((" + sortField + " " + operator + " " + literal + ") OR (" + sortField + " = " + literal
                + " AND toolEventId " + operator + " 'evt-1'))";
    }

    private static String orderBy(String sortField, String direction) {
        return sortField + " " + direction + ", toolEventId " + direction;
    }

    private static Stream<Arguments> sqlMetacharacterPayloads() {
        return Stream.of(
                arguments("O'Brien", "'O''Brien'"),
                arguments("a\\b", "'a\\\\b'"),
                arguments("x'; DROP TABLE logs;--", "'x''; DROP TABLE logs;--'"),
                arguments("\\'; DROP TABLE logs;--", "'\\\\''; DROP TABLE logs;--'"),
                arguments("x') OR (tenantId != 'uuid-aaa", "'x'') OR (tenantId != ''uuid-aaa'"));
    }

    private static Stream<Arguments> positionsOfTheRow() {
        return Stream.of(
                arguments("eventTimestamp", LogSortPosition.ofTimestamp(1_700_000_000_000L, "evt-1")),
                arguments("severity", LogSortPosition.ofText("INFO", "evt-1")),
                arguments("eventType", LogSortPosition.ofText("LOGIN", "evt-1")),
                arguments("toolType", LogSortPosition.ofText("FLEET", "evt-1")),
                arguments("organizationId", LogSortPosition.ofText("org-1", "evt-1")),
                arguments("deviceId", LogSortPosition.ofText("dev-1", "evt-1")),
                arguments("ingestDay", LogSortPosition.ofText("2026-10-01", "evt-1")));
    }

    private static LogProjection row() {
        return LogProjection.builder()
                .toolEventId("evt-1")
                .eventTimestamp(Instant.ofEpochMilli(1_700_000_000_000L))
                .severity("INFO")
                .eventType("LOGIN")
                .toolType("FLEET")
                .organizationId("org-1")
                .deviceId("dev-1")
                .ingestDay("2026-10-01")
                .build();
    }

    private void whenQueryReturnsEmptyRows() {
        when(pinotConnection.execute(anyString())).thenReturn(resultSetGroup);
        when(resultSetGroup.getResultSet(0)).thenReturn(resultSet);
        when(resultSet.getRowCount()).thenReturn(0);
    }

    private String captureExecutedQuery() {
        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        org.mockito.Mockito.verify(pinotConnection).execute(captor.capture());
        return captor.getValue();
    }
}
