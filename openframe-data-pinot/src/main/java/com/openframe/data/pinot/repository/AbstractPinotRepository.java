package com.openframe.data.pinot.repository;

import com.openframe.data.pinot.repository.exception.PinotQueryException;
import lombok.extern.slf4j.Slf4j;
import org.apache.pinot.client.Connection;
import org.apache.pinot.client.ResultSet;
import org.apache.pinot.client.ResultSetGroup;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

/**
 * Base class for Pinot-backed repositories. Centralises query execution,
 * ResultSet iteration, and error handling so concrete repositories focus
 * only on their domain-specific row mapping.
 */
@Slf4j
public abstract class AbstractPinotRepository {

    protected final Connection pinotConnection;

    protected AbstractPinotRepository(Connection pinotConnection) {
        this.pinotConnection = pinotConnection;
    }

    /**
     * Executes a query and maps each row with the supplied mapper.
     * The mapper receives the ResultSet and returns a row-index → T function
     * so callers can cache column lookups once per ResultSet.
     */
    protected <T> List<T> executeQuery(String query, Function<ResultSet, Function<Integer, T>> mapper) {
        try {
            log.debug("Executing Pinot query: {}", query);
            ResultSetGroup resultSetGroup = pinotConnection.execute(query);
            ResultSet resultSet = resultSetGroup.getResultSet(PinotQueryBuilder.FIRST_RESULT_SET_INDEX);

            Function<Integer, T> rowMapper = mapper.apply(resultSet);
            return IntStream.range(0, resultSet.getRowCount())
                    .mapToObj(rowMapper::apply)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Error executing Pinot query: {}", query, e);
            throw new PinotQueryException("Failed to execute Pinot query: " + e.getMessage(), e);
        }
    }

    /**
     * Convenience: execute a query that selects one column and return its
     * non-null, non-empty string values.
     */
    protected List<String> executeSingleColumnQuery(String query) {
        return executeQuery(query, rs -> rowIndex -> {
            String value = rs.getString(rowIndex, PinotQueryBuilder.FIRST_COLUMN_INDEX);
            return (value != null && !value.isEmpty()) ? value : null;
        }).stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    /**
     * Convenience: execute a query with two columns (value, count) and return
     * an ordered {@code Map<value, count>}. Null/empty keys are skipped.
     */
    protected Map<String, Integer> executeKeyCountQuery(String query) {
        try {
            log.debug("Executing Pinot query: {}", query);
            ResultSetGroup resultSetGroup = pinotConnection.execute(query);
            ResultSet resultSet = resultSetGroup.getResultSet(PinotQueryBuilder.FIRST_RESULT_SET_INDEX);

            Map<String, Integer> options = new LinkedHashMap<>();
            for (int i = 0; i < resultSet.getRowCount(); i++) {
                String value = resultSet.getString(i, PinotQueryBuilder.FIRST_COLUMN_INDEX);
                if (value != null && !value.isEmpty()) {
                    long count = resultSet.getLong(i, 1);
                    options.put(value, (int) count);
                }
            }
            return options;
        } catch (Exception e) {
            log.error("Error executing Pinot query: {}", query, e);
            throw new PinotQueryException("Failed to execute Pinot query: " + e.getMessage(), e);
        }
    }

    /**
     * Convenience: execute a COUNT(*) query and return the single integer result.
     */
    protected int executeCountQuery(String query) {
        try {
            log.debug("Executing Pinot count query: {}", query);
            ResultSetGroup resultSetGroup = pinotConnection.execute(query);
            ResultSet resultSet = resultSetGroup.getResultSet(PinotQueryBuilder.FIRST_RESULT_SET_INDEX);

            if (resultSet.getRowCount() > 0) {
                return (int) resultSet.getLong(0, PinotQueryBuilder.FIRST_COLUMN_INDEX);
            }
            return 0;
        } catch (Exception e) {
            log.error("Error executing Pinot count query: {}", query, e);
            throw new PinotQueryException("Failed to execute Pinot count query: " + e.getMessage(), e);
        }
    }

    /**
     * Build a column-name → index map for a ResultSet. Useful when the
     * query selects many columns and the mapper wants name-based access
     * instead of hardcoded indices.
     */
    protected Map<String, Integer> buildColumnIndexMap(ResultSet resultSet) {
        Map<String, Integer> columnIndexMap = new HashMap<>();
        for (int i = 0; i < resultSet.getColumnCount(); i++) {
            columnIndexMap.put(resultSet.getColumnName(i), i);
        }
        return columnIndexMap;
    }
}
