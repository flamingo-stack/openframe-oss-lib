package com.openframe.data.pinot.repository;

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
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PinotClientDeviceRepositoryTest {

    private static final String TENANT_ID = "uuid-aaa";

    @Mock
    private Connection pinotConnection;

    @Mock
    private ResultSetGroup resultSetGroup;

    @Mock
    private ResultSet resultSet;

    private PinotClientDeviceRepository repository;

    @BeforeEach
    void setUp() throws Exception {
        repository = new PinotClientDeviceRepository(pinotConnection);
        setField(repository, "devicesTable", "devices");
    }

    @Nested
    @DisplayName("tenantId validation & propagation")
    class TenantIdValidation {

        @Test
        @DisplayName("getStatusFilterOptions throws when tenantId is null")
        void throwsOnNullTenant() {
            assertThrows(PinotQueryException.class, () ->
                    repository.getStatusFilterOptions(null, List.of(), List.of(), List.of(),
                            List.of(), List.of(), List.of()));
        }

        @Test
        @DisplayName("getFilteredDeviceCount throws when tenantId is blank")
        void countThrowsOnBlankTenant() {
            assertThrows(PinotQueryException.class, () ->
                    repository.getFilteredDeviceCount("  ", List.of(), List.of(), List.of(),
                            List.of(), List.of(), List.of()));
        }

        @Test
        @DisplayName("all facet queries include tenantId filter")
        void allFacetQueriesIncludeTenant() {
            whenQueryReturnsEmptyRows();

            repository.getStatusFilterOptions(TENANT_ID, List.of(), List.of(), List.of(), List.of(), List.of(), List.of());
            repository.getDeviceTypeFilterOptions(TENANT_ID, List.of(), List.of(), List.of(), List.of(), List.of(), List.of());
            repository.getOsTypeFilterOptions(TENANT_ID, List.of(), List.of(), List.of(), List.of(), List.of(), List.of());
            repository.getOrganizationFilterOptions(TENANT_ID, List.of(), List.of(), List.of(), List.of(), List.of(), List.of());
            repository.getTagKeyFilterOptions(TENANT_ID, List.of(), List.of(), List.of(), List.of(), List.of(), List.of());
            repository.getFilteredDeviceCount(TENANT_ID, List.of(), List.of(), List.of(), List.of(), List.of(), List.of());

            ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
            verify(pinotConnection, org.mockito.Mockito.times(6)).execute(captor.capture());
            for (String query : captor.getAllValues()) {
                assertTrue(query.contains("tenantId = 'uuid-aaa'"),
                        "Query missing tenantId: " + query);
            }
        }
    }

    @Nested
    @DisplayName("facet query structure")
    class FacetQueryStructure {

        @Test
        @DisplayName("getStatusFilterOptions groups by status and orders by count desc")
        void statusFacetStructure() {
            whenQueryReturnsEmptyRows();
            repository.getStatusFilterOptions(TENANT_ID, List.of(), List.of(), List.of(),
                    List.of(), List.of(), List.of());
            String query = captureQuery();
            assertTrue(query.contains("SELECT status, COUNT(*) as count"), "was: " + query);
            assertTrue(query.contains("GROUP BY status"), "was: " + query);
            assertTrue(query.contains("ORDER BY count DESC"), "was: " + query);
        }

        @Test
        @DisplayName("getOrganizationFilterOptions groups by organizationId")
        void organizationFacetStructure() {
            whenQueryReturnsEmptyRows();
            repository.getOrganizationFilterOptions(TENANT_ID, List.of(), List.of(), List.of(),
                    List.of(), List.of(), List.of());
            String query = captureQuery();
            assertTrue(query.contains("SELECT organizationId, COUNT(*) as count"));
            assertTrue(query.contains("GROUP BY organizationId"));
        }

        @Test
        @DisplayName("all facet queries exclude DELETED devices")
        void excludesDeletedDevices() {
            whenQueryReturnsEmptyRows();
            repository.getStatusFilterOptions(TENANT_ID, List.of(), List.of(), List.of(),
                    List.of(), List.of(), List.of());
            String query = captureQuery();
            assertTrue(query.contains("status != 'DELETED'"), "was: " + query);
        }
    }

    @Nested
    @DisplayName("faceted filtering (excludeField behavior)")
    class ExcludeFieldBehavior {

        @Test
        @DisplayName("status facet does NOT filter by status from user selection")
        void statusFacetSkipsStatusFilter() {
            whenQueryReturnsEmptyRows();
            repository.getStatusFilterOptions(TENANT_ID, List.of("ACTIVE"),
                    List.of("LAPTOP"), List.of(), List.of(), List.of(), List.of());
            String query = captureQuery();
            // deviceType filter should be applied
            assertTrue(query.contains("deviceType = 'LAPTOP'"), "deviceType missing: " + query);
            // status filter should NOT be applied (but the DELETED exclusion still is)
            assertTrue(query.contains("status != 'DELETED'"));
            assertTrue(!query.contains("status = 'ACTIVE'"), "status = ACTIVE should be excluded: " + query);
        }

        @Test
        @DisplayName("deviceType facet does NOT filter by deviceType from user selection")
        void deviceTypeFacetSkipsDeviceTypeFilter() {
            whenQueryReturnsEmptyRows();
            repository.getDeviceTypeFilterOptions(TENANT_ID, List.of(),
                    List.of("LAPTOP"), List.of("WINDOWS"), List.of(), List.of(), List.of());
            String query = captureQuery();
            // osType filter applied
            assertTrue(query.contains("osType = 'WINDOWS'"), "osType missing: " + query);
            // deviceType filter NOT applied
            assertTrue(!query.contains("deviceType = 'LAPTOP'"),
                    "deviceType should be excluded: " + query);
        }

        @Test
        @DisplayName("filtered DELETED values are removed from user status filter")
        void statusFilterRemovesDeletedValue() {
            whenQueryReturnsEmptyRows();
            repository.getDeviceTypeFilterOptions(TENANT_ID, List.of("ACTIVE", "DELETED"),
                    List.of(), List.of(), List.of(), List.of(), List.of());
            String query = captureQuery();
            assertTrue(query.contains("status = 'ACTIVE'"));
            // DELETED should be filtered out (only the "!= DELETED" remains)
            int deletedOccurrences = query.split("status = 'DELETED'", -1).length - 1;
            assertEquals(0, deletedOccurrences,
                    "status = 'DELETED' should not appear as a positive filter: " + query);
        }
    }

    @Nested
    @DisplayName("count and result mapping")
    class CountAndMapping {

        @Test
        @DisplayName("getFilteredDeviceCount returns long count from first cell")
        void countReturnsFromFirstCell() {
            when(pinotConnection.execute(anyString())).thenReturn(resultSetGroup);
            when(resultSetGroup.getResultSet(0)).thenReturn(resultSet);
            when(resultSet.getRowCount()).thenReturn(1);
            when(resultSet.getLong(0, 0)).thenReturn(42L);

            int count = repository.getFilteredDeviceCount(TENANT_ID, List.of(), List.of(), List.of(),
                    List.of(), List.of(), List.of());
            assertEquals(42, count);
        }

        @Test
        @DisplayName("getStatusFilterOptions maps rows to Map<value, count>")
        void facetMapsRowsToMap() {
            when(pinotConnection.execute(anyString())).thenReturn(resultSetGroup);
            when(resultSetGroup.getResultSet(0)).thenReturn(resultSet);
            when(resultSet.getRowCount()).thenReturn(2);
            when(resultSet.getString(0, 0)).thenReturn("ACTIVE");
            when(resultSet.getLong(0, 1)).thenReturn(10L);
            when(resultSet.getString(1, 0)).thenReturn("OFFLINE");
            when(resultSet.getLong(1, 1)).thenReturn(5L);

            Map<String, Integer> result = repository.getStatusFilterOptions(
                    TENANT_ID, List.of(), List.of(), List.of(), List.of(), List.of(), List.of());

            assertEquals(2, result.size());
            assertEquals(10, result.get("ACTIVE"));
            assertEquals(5, result.get("OFFLINE"));
        }

        @Test
        @DisplayName("getFilteredDeviceCount returns 0 when no rows")
        void countReturnsZeroOnEmpty() {
            when(pinotConnection.execute(anyString())).thenReturn(resultSetGroup);
            when(resultSetGroup.getResultSet(0)).thenReturn(resultSet);
            when(resultSet.getRowCount()).thenReturn(0);

            int count = repository.getFilteredDeviceCount(TENANT_ID, List.of(), List.of(), List.of(),
                    List.of(), List.of(), List.of());
            assertEquals(0, count);
        }
    }

    @Nested
    @DisplayName("SQL injection protection")
    class SqlInjection {

        @Test
        @DisplayName("tenantId single quotes are escaped in WHERE clause")
        void tenantIdEscaped() {
            whenQueryReturnsEmptyRows();
            repository.getFilteredDeviceCount("evil'; DROP TABLE devices;--",
                    List.of(), List.of(), List.of(), List.of(), List.of(), List.of());
            String query = captureQuery();
            assertTrue(query.contains("tenantId = 'evil''; DROP TABLE devices;--'"),
                    "Quotes not escaped: " + query);
        }
    }

    // ----- helpers -----

    private void whenQueryReturnsEmptyRows() {
        when(pinotConnection.execute(anyString())).thenReturn(resultSetGroup);
        when(resultSetGroup.getResultSet(0)).thenReturn(resultSet);
        when(resultSet.getRowCount()).thenReturn(0);
    }

    private String captureQuery() {
        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        verify(pinotConnection).execute(captor.capture());
        return captor.getValue();
    }

    private static void setField(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}
