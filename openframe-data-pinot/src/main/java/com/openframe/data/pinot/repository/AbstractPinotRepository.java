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

@Slf4j
public abstract class AbstractPinotRepository {

    protected final Connection pinotConnection;

    protected AbstractPinotRepository(Connection pinotConnection) {
        this.pinotConnection = pinotConnection;
    }

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

    protected List<String> executeSingleColumnQuery(String query) {
        return executeQuery(query, rs -> rowIndex -> {
            String value = rs.getString(rowIndex, PinotQueryBuilder.FIRST_COLUMN_INDEX);
            return (value != null && !value.isEmpty()) ? value : null;
        }).stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

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

    // A column selected by the query but absent from the ResultSet means the Pinot schema has not
    // caught up with the deployed code. Degrade that one field to null rather than failing the page.
    protected String readString(ResultSet resultSet, int rowIndex, Map<String, Integer> columnIndexMap, String column) {
        Integer columnIndex = columnIndexMap.get(column);
        if (columnIndex == null) {
            log.debug("Column {} missing from Pinot result set - returning null", column);
            return null;
        }
        return resultSet.getString(rowIndex, columnIndex);
    }

    protected Map<String, Integer> buildColumnIndexMap(ResultSet resultSet) {
        Map<String, Integer> columnIndexMap = new HashMap<>();
        for (int i = 0; i < resultSet.getColumnCount(); i++) {
            columnIndexMap.put(resultSet.getColumnName(i), i);
        }
        return columnIndexMap;
    }
}
