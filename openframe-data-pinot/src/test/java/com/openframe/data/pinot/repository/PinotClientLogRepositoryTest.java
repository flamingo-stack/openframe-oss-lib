package com.openframe.data.pinot.repository;

import com.openframe.data.pinot.model.LogProjection;
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
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
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
                    repository.findLogs(null, START, END, List.of(), List.of(), List.of(),
                            List.of(), null, null, 100, "eventTimestamp", "DESC"));
        }

        @Test
        @DisplayName("findLogs throws when tenantId is blank (builder validation)")
        void findLogsThrowsOnBlankTenant() {
            assertThrows(PinotQueryException.class, () ->
                    repository.findLogs("  ", START, END, List.of(), List.of(), List.of(),
                            List.of(), null, null, 100, "eventTimestamp", "DESC"));
        }

        @Test
        @DisplayName("findLogs query contains tenantId filter")
        void findLogsIncludesTenantId() {
            whenQueryReturnsEmptyRows();
            repository.findLogs(TENANT_ID, START, END, List.of(), List.of(), List.of(),
                    List.of(), null, null, 100, "eventTimestamp", "DESC");
            String query = captureExecutedQuery();
            assertTrue(query.contains("tenantId = 'uuid-aaa'"),
                    "findLogs query missing tenantId filter: " + query);
        }

        @Test
        @DisplayName("searchLogs query contains tenantId filter")
        void searchLogsIncludesTenantId() {
            whenQueryReturnsEmptyRows();
            repository.searchLogs(TENANT_ID, START, END, List.of(), List.of(), List.of(),
                    List.of(), null, "term", null, 100, "eventTimestamp", "DESC");
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
            // 12 columns as declared in findLogs: toolEventId, ingestDay, toolType, eventType,
            // severity, userId, deviceId, hostname, organizationId, organizationName, summary, eventTimestamp
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

            when(resultSet.getString(0, 0)).thenReturn("evt-1");
            when(resultSet.getString(0, 1)).thenReturn("2026-01-15");
            when(resultSet.getString(0, 2)).thenReturn("FLEET_MDM");
            when(resultSet.getString(0, 3)).thenReturn("DEVICE_ONLINE");
            when(resultSet.getString(0, 4)).thenReturn("INFO");
            when(resultSet.getString(0, 5)).thenReturn("user-1");
            when(resultSet.getString(0, 6)).thenReturn("dev-1");
            when(resultSet.getString(0, 7)).thenReturn("host-1");
            when(resultSet.getString(0, 8)).thenReturn("org-1");
            when(resultSet.getString(0, 9)).thenReturn("Org One");
            when(resultSet.getString(0, 10)).thenReturn("Device came online");
            when(resultSet.getLong(0, 11)).thenReturn(1700000000000L);

            List<LogProjection> result = repository.findLogs(TENANT_ID, START, END, List.of(), List.of(),
                    List.of(), List.of(), null, null, 100, "eventTimestamp", "DESC");

            assertEquals(1, result.size());
            LogProjection p = result.get(0);
            assertEquals("evt-1", p.toolEventId);
            assertEquals("FLEET_MDM", p.toolType);
            assertEquals("INFO", p.severity);
            assertEquals("Org One", p.organizationName);
            assertNotNull(p.eventTimestamp);
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

    // ----- helpers -----

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
