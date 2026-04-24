package com.openframe.data.pinot.repository;

import com.openframe.data.pinot.repository.exception.PinotQueryException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
}
