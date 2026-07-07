package com.openframe.data.pinot.repository;

import com.openframe.data.pinot.repository.exception.PinotQueryException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PinotQueryBuilderTest {

    private static final String TABLE = "logs";
    private static final String TENANT_ID = "uuid-aaa";

    @Nested
    @DisplayName("tenantId validation")
    class TenantIdValidation {

        @Test
        @DisplayName("throws when tenantId is null")
        void throwsWhenTenantIdIsNull() {
            PinotQueryException ex = assertThrows(PinotQueryException.class,
                    () -> new PinotQueryBuilder(TABLE, null));
            assertTrue(ex.getMessage().contains("tenantId is required"));
        }

        @Test
        @DisplayName("throws when tenantId is empty string")
        void throwsWhenTenantIdIsEmpty() {
            assertThrows(PinotQueryException.class,
                    () -> new PinotQueryBuilder(TABLE, ""));
        }

        @Test
        @DisplayName("throws when tenantId is whitespace")
        void throwsWhenTenantIdIsBlank() {
            assertThrows(PinotQueryException.class,
                    () -> new PinotQueryBuilder(TABLE, "   "));
        }

        @Test
        @DisplayName("accepts valid tenantId")
        void acceptsValidTenantId() {
            PinotQueryBuilder builder = new PinotQueryBuilder(TABLE, TENANT_ID);
            String query = builder.select("id").build();
            assertTrue(query.contains("tenantId = 'uuid-aaa'"),
                    "Expected query to contain tenantId filter but was: " + query);
        }
    }

    @Nested
    @DisplayName("tenantId SQL escaping")
    class TenantIdEscaping {

        @Test
        @DisplayName("escapes single quotes in tenantId to prevent SQL injection")
        void escapesSingleQuotes() {
            PinotQueryBuilder builder = new PinotQueryBuilder(TABLE, "evil'; DROP TABLE logs;--");
            String query = builder.select("id").build();
            // Single quote should be doubled; no unescaped quote-semicolon sequence
            assertTrue(query.contains("tenantId = 'evil''; DROP TABLE logs;--'"),
                    "Expected escaped tenantId but was: " + query);
        }
    }

    @Nested
    @DisplayName("auto-added tenantId WHERE clause")
    class AutoAddedTenantFilter {

        @Test
        @DisplayName("tenantId is first WHERE condition")
        void tenantIdIsFirstCondition() {
            String query = new PinotQueryBuilder(TABLE, TENANT_ID)
                    .select("id")
                    .whereEquals("status", "ACTIVE")
                    .build();
            int tenantIdx = query.indexOf("tenantId = 'uuid-aaa'");
            int statusIdx = query.indexOf("status = 'ACTIVE'");
            assertTrue(tenantIdx > 0 && tenantIdx < statusIdx,
                    "tenantId should appear before other filters in: " + query);
        }

        @Test
        @DisplayName("tenantId is added even without additional WHERE calls")
        void tenantIdAddedWithoutOtherFilters() {
            String query = new PinotQueryBuilder(TABLE, TENANT_ID)
                    .select("id")
                    .build();
            assertTrue(query.contains("WHERE tenantId = 'uuid-aaa'"),
                    "Expected bare WHERE with just tenantId: " + query);
        }
    }

    @Nested
    @DisplayName("full query composition")
    class FullQueryComposition {

        @Test
        @DisplayName("builds a simple SELECT query")
        void buildsSimpleSelect() {
            String query = new PinotQueryBuilder(TABLE, TENANT_ID)
                    .select("eventType", "severity")
                    .build();
            assertTrue(query.startsWith("SELECT eventType, severity FROM"));
            assertTrue(query.contains("\"logs\""));
            assertTrue(query.contains("tenantId = 'uuid-aaa'"));
        }

        @Test
        @DisplayName("combines tenantId with date range and IN filter")
        void combinesWithMultipleFilters() {
            String query = new PinotQueryBuilder(TABLE, TENANT_ID)
                    .select("id")
                    .whereDateRange("eventTimestamp", LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31))
                    .whereIn("severity", List.of("ERROR", "WARN"))
                    .limit(100)
                    .build();
            assertTrue(query.contains("tenantId = 'uuid-aaa'"));
            assertTrue(query.contains("severity IN"));
            assertTrue(query.contains("eventTimestamp"));
            assertTrue(query.contains("LIMIT 100"));
        }

        @Test
        @DisplayName("builds COUNT query with tenantId filter")
        void buildsCountQuery() {
            String query = new PinotQueryBuilder(TABLE, TENANT_ID)
                    .selectCountAll()
                    .build();
            assertTrue(query.contains("COUNT(*)"));
            assertTrue(query.contains("tenantId = 'uuid-aaa'"));
        }

        @Test
        @DisplayName("builds facet query with GROUP BY and ORDER BY count DESC")
        void buildsFacetQuery() {
            String query = new PinotQueryBuilder(TABLE, TENANT_ID)
                    .select("status")
                    .selectCount()
                    .groupBy("status")
                    .orderByCountDesc()
                    .build();
            assertTrue(query.contains("SELECT status, COUNT(*) as count"));
            assertTrue(query.contains("GROUP BY status"));
            assertTrue(query.contains("ORDER BY count DESC"));
            assertTrue(query.contains("tenantId = 'uuid-aaa'"));
        }

        @Test
        @DisplayName("whereOr produces parenthesized OR chain")
        void whereOrBuildsOrChain() {
            String query = new PinotQueryBuilder(TABLE, TENANT_ID)
                    .select("id")
                    .whereOr("deviceType", List.of("LAPTOP", "DESKTOP", "PHONE"))
                    .build();
            assertTrue(query.contains("(deviceType = 'LAPTOP' OR deviceType = 'DESKTOP' OR deviceType = 'PHONE')"),
                    "Expected OR-joined conditions in: " + query);
        }

        @Test
        @DisplayName("whereNotEquals negates correctly")
        void whereNotEquals() {
            String query = new PinotQueryBuilder(TABLE, TENANT_ID)
                    .select("id")
                    .whereNotEquals("status", "DELETED")
                    .build();
            assertTrue(query.contains("status != 'DELETED'"));
        }
    }

    @Nested
    @DisplayName("tableName validation")
    class TableNameValidation {

        @Test
        @DisplayName("throws when tableName is null")
        void throwsWhenTableIsNull() {
            assertThrows(PinotQueryException.class,
                    () -> new PinotQueryBuilder(null, TENANT_ID));
        }

        @Test
        @DisplayName("throws when tableName is empty")
        void throwsWhenTableIsEmpty() {
            assertThrows(PinotQueryException.class,
                    () -> new PinotQueryBuilder("", TENANT_ID));
        }

        @Test
        @DisplayName("quotes table name in FROM clause")
        void quotesTableName() {
            String query = new PinotQueryBuilder(TABLE, TENANT_ID).select("id").build();
            assertTrue(query.contains("FROM \"logs\""));
        }
    }

    @Nested
    @DisplayName("build state validation")
    class BuildStateValidation {

        @Test
        @DisplayName("throws when build called without any select columns")
        void throwsWithoutSelect() {
            PinotQueryBuilder builder = new PinotQueryBuilder(TABLE, TENANT_ID);
            assertThrows(PinotQueryException.class, builder::build);
        }

        @Test
        @DisplayName("limit must be positive")
        void limitMustBePositive() {
            PinotQueryBuilder builder = new PinotQueryBuilder(TABLE, TENANT_ID).select("id");
            assertThrows(PinotQueryException.class, () -> builder.limit(0));
        }
    }

    @Nested
    @DisplayName("whereTimestampRange (millisecond Instant bounds)")
    class WhereTimestampRange {

        @Test
        @DisplayName("emits inclusive >= / <= epoch-millis bounds when both are provided")
        void bothBounds() {
            String query = new PinotQueryBuilder(TABLE, TENANT_ID)
                    .select("id")
                    .whereTimestampRange("eventTimestamp", Instant.ofEpochMilli(1000), Instant.ofEpochMilli(2000))
                    .build();
            assertTrue(query.contains("eventTimestamp >= 1000"), query);
            assertTrue(query.contains("eventTimestamp <= 2000"), query);
        }

        @Test
        @DisplayName("uses millisecond precision (not day granularity)")
        void millisecondPrecision() {
            String query = new PinotQueryBuilder(TABLE, TENANT_ID)
                    .select("id")
                    .whereTimestampRange("eventTimestamp", Instant.ofEpochMilli(1_700_000_123_456L), null)
                    .build();
            assertTrue(query.contains("eventTimestamp >= 1700000123456"), query);
        }

        @Test
        @DisplayName("emits only the lower bound when 'to' is null")
        void fromOnly() {
            String query = new PinotQueryBuilder(TABLE, TENANT_ID)
                    .select("id")
                    .whereTimestampRange("eventTimestamp", Instant.ofEpochMilli(1500), null)
                    .build();
            assertTrue(query.contains("eventTimestamp >= 1500"), query);
            assertFalse(query.contains("<="), query);
        }

        @Test
        @DisplayName("emits only the upper bound when 'from' is null")
        void toOnly() {
            String query = new PinotQueryBuilder(TABLE, TENANT_ID)
                    .select("id")
                    .whereTimestampRange("eventTimestamp", null, Instant.ofEpochMilli(2500))
                    .build();
            assertTrue(query.contains("eventTimestamp <= 2500"), query);
            assertFalse(query.contains(">="), query);
        }

        @Test
        @DisplayName("adds no timestamp condition when both bounds are null")
        void noBounds() {
            String query = new PinotQueryBuilder(TABLE, TENANT_ID)
                    .select("id")
                    .whereTimestampRange("eventTimestamp", null, null)
                    .build();
            assertFalse(query.contains(">="), query);
            assertFalse(query.contains("<="), query);
        }
    }

    @Nested
    @DisplayName("whereCursor (direction-aware keyset)")
    class WhereCursor {

        private static final String CURSOR = "1700000000000_evt-1";

        @Test
        @DisplayName("DESC pages toward older rows using '<'")
        void descUsesLessThan() {
            String query = new PinotQueryBuilder(TABLE, TENANT_ID)
                    .select("id")
                    .whereCursor(CURSOR, "DESC")
                    .build();
            assertTrue(query.contains("(eventTimestamp < 1700000000000)"), query);
            assertTrue(query.contains("(eventTimestamp = 1700000000000 AND toolEventId < 'evt-1')"), query);
        }

        @Test
        @DisplayName("ASC pages toward newer rows using '>'")
        void ascUsesGreaterThan() {
            String query = new PinotQueryBuilder(TABLE, TENANT_ID)
                    .select("id")
                    .whereCursor(CURSOR, "ASC")
                    .build();
            assertTrue(query.contains("(eventTimestamp > 1700000000000)"), query);
            assertTrue(query.contains("(eventTimestamp = 1700000000000 AND toolEventId > 'evt-1')"), query);
        }

        @Test
        @DisplayName("null direction defaults to DESC ('<')")
        void nullDirectionDefaultsToDesc() {
            String query = new PinotQueryBuilder(TABLE, TENANT_ID)
                    .select("id")
                    .whereCursor(CURSOR, null)
                    .build();
            assertTrue(query.contains("(eventTimestamp < 1700000000000)"), query);
        }

        @Test
        @DisplayName("null cursor adds no keyset condition")
        void nullCursorNoop() {
            String query = new PinotQueryBuilder(TABLE, TENANT_ID)
                    .select("id")
                    .whereCursor(null, "DESC")
                    .build();
            assertFalse(query.contains("eventTimestamp <"), query);
            assertFalse(query.contains("eventTimestamp >"), query);
        }

        @Test
        @DisplayName("throws on a malformed cursor (missing separator)")
        void throwsOnMalformedCursor() {
            PinotQueryBuilder builder = new PinotQueryBuilder(TABLE, TENANT_ID).select("id");
            assertThrows(PinotQueryException.class, () -> builder.whereCursor("no-separator", "DESC"));
        }
    }
}
