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
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AbstractPinotRepositoryTest {

    @Mock
    private Connection pinotConnection;

    @Mock
    private ResultSetGroup resultSetGroup;

    @Mock
    private ResultSet resultSet;

    private TestRepository repository;

    @BeforeEach
    void setUp() {
        repository = new TestRepository(pinotConnection);
    }

    @Nested
    @DisplayName("executeQuery")
    class ExecuteQuery {

        @Test
        @DisplayName("maps each row via provided mapper")
        void mapsRows() {
            when(pinotConnection.execute(anyString())).thenReturn(resultSetGroup);
            when(resultSetGroup.getResultSet(0)).thenReturn(resultSet);
            when(resultSet.getRowCount()).thenReturn(3);
            when(resultSet.getString(0, 0)).thenReturn("a");
            when(resultSet.getString(1, 0)).thenReturn("b");
            when(resultSet.getString(2, 0)).thenReturn("c");

            List<String> result = repository.doExecuteQuery("SELECT x FROM t",
                    rs -> rowIdx -> rs.getString(rowIdx, 0));

            assertEquals(List.of("a", "b", "c"), result);
        }

        @Test
        @DisplayName("wraps exceptions as PinotQueryException")
        void wrapsExceptions() {
            when(pinotConnection.execute(anyString()))
                    .thenThrow(new RuntimeException("broker down"));
            assertThrows(PinotQueryException.class,
                    () -> repository.doExecuteQuery("SELECT 1", rs -> i -> "x"));
        }
    }

    @Nested
    @DisplayName("executeSingleColumnQuery")
    class ExecuteSingleColumnQuery {

        @Test
        @DisplayName("returns non-null, non-empty string values")
        void filtersNullAndEmpty() {
            when(pinotConnection.execute(anyString())).thenReturn(resultSetGroup);
            when(resultSetGroup.getResultSet(0)).thenReturn(resultSet);
            when(resultSet.getRowCount()).thenReturn(4);
            when(resultSet.getString(0, 0)).thenReturn("FLEET_MDM");
            when(resultSet.getString(1, 0)).thenReturn(null);     // filtered
            when(resultSet.getString(2, 0)).thenReturn("");       // filtered
            when(resultSet.getString(3, 0)).thenReturn("TACTICAL_RMM");

            List<String> result = repository.doExecuteSingleColumnQuery("SELECT toolType FROM t");
            assertEquals(List.of("FLEET_MDM", "TACTICAL_RMM"), result);
        }
    }

    @Nested
    @DisplayName("executeKeyCountQuery")
    class ExecuteKeyCountQuery {

        @Test
        @DisplayName("returns ordered Map<value, count>")
        void returnsOrderedMap() {
            when(pinotConnection.execute(anyString())).thenReturn(resultSetGroup);
            when(resultSetGroup.getResultSet(0)).thenReturn(resultSet);
            when(resultSet.getRowCount()).thenReturn(3);
            when(resultSet.getString(0, 0)).thenReturn("ACTIVE");
            when(resultSet.getLong(0, 1)).thenReturn(100L);
            when(resultSet.getString(1, 0)).thenReturn("OFFLINE");
            when(resultSet.getLong(1, 1)).thenReturn(50L);
            when(resultSet.getString(2, 0)).thenReturn("PENDING");
            when(resultSet.getLong(2, 1)).thenReturn(10L);

            Map<String, Integer> result = repository.doExecuteKeyCountQuery("SELECT status, COUNT(*) FROM t GROUP BY status");

            assertEquals(3, result.size());
            assertEquals(100, result.get("ACTIVE"));
            assertEquals(50, result.get("OFFLINE"));
            assertEquals(10, result.get("PENDING"));
            // Verify insertion order
            assertEquals(List.of("ACTIVE", "OFFLINE", "PENDING"), List.copyOf(result.keySet()));
        }

        @Test
        @DisplayName("skips null/empty keys")
        void skipsBlankKeys() {
            when(pinotConnection.execute(anyString())).thenReturn(resultSetGroup);
            when(resultSetGroup.getResultSet(0)).thenReturn(resultSet);
            when(resultSet.getRowCount()).thenReturn(3);
            when(resultSet.getString(0, 0)).thenReturn("ACTIVE");
            when(resultSet.getLong(0, 1)).thenReturn(100L);
            when(resultSet.getString(1, 0)).thenReturn(null);  // skipped
            when(resultSet.getString(2, 0)).thenReturn("");    // skipped

            Map<String, Integer> result = repository.doExecuteKeyCountQuery("SELECT x FROM t");
            assertEquals(1, result.size());
            assertEquals(100, result.get("ACTIVE"));
        }
    }

    @Nested
    @DisplayName("executeCountQuery")
    class ExecuteCountQuery {

        @Test
        @DisplayName("returns count from first cell")
        void returnsFirstCellCount() {
            when(pinotConnection.execute(anyString())).thenReturn(resultSetGroup);
            when(resultSetGroup.getResultSet(0)).thenReturn(resultSet);
            when(resultSet.getRowCount()).thenReturn(1);
            when(resultSet.getLong(0, 0)).thenReturn(123L);

            assertEquals(123, repository.doExecuteCountQuery("SELECT COUNT(*) FROM t"));
        }

        @Test
        @DisplayName("returns 0 when no rows")
        void returnsZeroWhenEmpty() {
            when(pinotConnection.execute(anyString())).thenReturn(resultSetGroup);
            when(resultSetGroup.getResultSet(0)).thenReturn(resultSet);
            when(resultSet.getRowCount()).thenReturn(0);

            assertEquals(0, repository.doExecuteCountQuery("SELECT COUNT(*) FROM t"));
        }
    }

    @Nested
    @DisplayName("buildColumnIndexMap")
    class BuildColumnIndexMap {

        @Test
        @DisplayName("maps column names to their index")
        void mapsColumnNamesToIndices() {
            when(resultSet.getColumnCount()).thenReturn(3);
            when(resultSet.getColumnName(0)).thenReturn("id");
            when(resultSet.getColumnName(1)).thenReturn("name");
            when(resultSet.getColumnName(2)).thenReturn("status");

            Map<String, Integer> map = repository.doBuildColumnIndexMap(resultSet);
            assertEquals(0, map.get("id"));
            assertEquals(1, map.get("name"));
            assertEquals(2, map.get("status"));
        }
    }

    /**
     * Concrete subclass that exposes protected methods for testing.
     */
    private static class TestRepository extends AbstractPinotRepository {
        TestRepository(Connection pinotConnection) {
            super(pinotConnection);
        }

        <T> List<T> doExecuteQuery(String query, java.util.function.Function<ResultSet, java.util.function.Function<Integer, T>> mapper) {
            return executeQuery(query, mapper);
        }

        List<String> doExecuteSingleColumnQuery(String query) {
            return executeSingleColumnQuery(query);
        }

        Map<String, Integer> doExecuteKeyCountQuery(String query) {
            return executeKeyCountQuery(query);
        }

        int doExecuteCountQuery(String query) {
            return executeCountQuery(query);
        }

        Map<String, Integer> doBuildColumnIndexMap(ResultSet resultSet) {
            return buildColumnIndexMap(resultSet);
        }
    }
}
