package com.openframe.data.cassandra.config;

import com.datastax.oss.driver.api.core.CqlIdentifier;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.metadata.Metadata;
import com.datastax.oss.driver.api.core.metadata.schema.ColumnMetadata;
import com.datastax.oss.driver.api.core.metadata.schema.KeyspaceMetadata;
import com.datastax.oss.driver.api.core.metadata.schema.TableMetadata;
import com.openframe.data.cassandra.model.CommandResult;
import com.openframe.data.cassandra.model.UnifiedLogEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.cassandra.core.convert.MappingCassandraConverter;
import org.springframework.data.cassandra.core.convert.SchemaFactory;
import org.springframework.data.cassandra.core.mapping.CassandraMappingContext;

import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CassandraTableColumnSyncTest {

    private static final String KEYSPACE = "openframe_test";
    private static final CqlIdentifier UNIFIED_LOGS = CqlIdentifier.fromCql("unified_logs");
    private static final CqlIdentifier COMMAND_RESULTS = CqlIdentifier.fromCql("command_results");
    private static final String[] UNIFIED_LOGS_COLUMNS_BEFORE_RUN_ORIGIN = {
            "user_id", "device_id", "hostname", "nickname", "organization_id", "organization_name",
            "severity", "message", "debezium_message", "details"};
    private static final String[] UNIFIED_LOGS_COLUMNS = {
            "user_id", "device_id", "hostname", "nickname", "execution_source", "script_creation_source",
            "organization_id", "organization_name", "severity", "message", "debezium_message", "details"};
    private static final String[] COMMAND_RESULTS_COLUMNS = {"result"};

    @Mock private CqlSession session;
    @Mock private Metadata metadata;
    @Mock private KeyspaceMetadata keyspace;
    @Mock private TableMetadata unifiedLogs;
    @Mock private TableMetadata commandResults;
    @Mock private ColumnMetadata column;

    @Captor private ArgumentCaptor<String> cqlCaptor;

    private CassandraTableColumnSync sync;

    @BeforeEach
    void setUp() {
        CassandraMappingContext mappingContext = new CassandraMappingContext();
        mappingContext.setInitialEntitySet(Set.of(UnifiedLogEvent.class, CommandResult.class));
        mappingContext.afterPropertiesSet();
        MappingCassandraConverter converter = new MappingCassandraConverter(mappingContext);
        converter.afterPropertiesSet();
        SchemaFactory schemaFactory = new SchemaFactory(converter);
        sync = new CassandraTableColumnSync(session, mappingContext, schemaFactory, KEYSPACE);
    }

    @Test
    void afterSingletonsInstantiated_runOriginColumnsMissing_addsEachWithIfNotExists() {
        // setup
        stubKeyspace();
        stubTable(UNIFIED_LOGS, unifiedLogs, UNIFIED_LOGS_COLUMNS_BEFORE_RUN_ORIGIN);
        stubTable(COMMAND_RESULTS, commandResults, COMMAND_RESULTS_COLUMNS);

        // execution
        sync.afterSingletonsInstantiated();

        // verifications
        verify(session, times(2)).execute(cqlCaptor.capture());
        assertThat(cqlCaptor.getAllValues()).containsExactlyInAnyOrder(
                "ALTER TABLE openframe_test.unified_logs ADD IF NOT EXISTS execution_source text",
                "ALTER TABLE openframe_test.unified_logs ADD IF NOT EXISTS script_creation_source text");
    }

    @Test
    void afterSingletonsInstantiated_allColumnsPresent_altersNothing() {
        // setup
        stubKeyspace();
        stubTable(UNIFIED_LOGS, unifiedLogs, UNIFIED_LOGS_COLUMNS);
        stubTable(COMMAND_RESULTS, commandResults, COMMAND_RESULTS_COLUMNS);

        // execution
        sync.afterSingletonsInstantiated();

        // verifications
        verify(session).refreshSchema();
        verifyNoMoreInteractions(session);
    }

    @Test
    void afterSingletonsInstantiated_tableNotCreatedYet_skipsThatTable() {
        // setup
        stubKeyspace();
        when(keyspace.getTable(UNIFIED_LOGS)).thenReturn(Optional.empty());
        stubTable(COMMAND_RESULTS, commandResults, COMMAND_RESULTS_COLUMNS);

        // execution
        sync.afterSingletonsInstantiated();

        // verifications
        verify(session).refreshSchema();
        verifyNoMoreInteractions(session);
    }

    @Test
    void afterSingletonsInstantiated_keyspaceMissing_throwsIllegalState() {
        // setup
        when(session.refreshSchema()).thenReturn(metadata);
        when(metadata.getKeyspace(KEYSPACE)).thenReturn(Optional.empty());

        // execution
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> sync.afterSingletonsInstantiated());

        // verifications
        assertThat(ex.getMessage()).contains(KEYSPACE);
    }

    private void stubKeyspace() {
        when(session.refreshSchema()).thenReturn(metadata);
        when(metadata.getKeyspace(KEYSPACE)).thenReturn(Optional.of(keyspace));
    }

    private void stubTable(CqlIdentifier name, TableMetadata table, String... existingColumns) {
        Map<CqlIdentifier, ColumnMetadata> columns = Stream.of(existingColumns)
                .collect(Collectors.toMap(CqlIdentifier::fromCql, existing -> column));
        when(keyspace.getTable(name)).thenReturn(Optional.of(table));
        when(table.getColumns()).thenReturn(columns);
    }
}
