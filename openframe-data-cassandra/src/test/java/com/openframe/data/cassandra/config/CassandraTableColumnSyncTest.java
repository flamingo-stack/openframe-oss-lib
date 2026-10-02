package com.openframe.data.cassandra.config;

import com.datastax.oss.driver.api.core.CqlIdentifier;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.DriverTimeoutException;
import com.datastax.oss.driver.api.core.cql.SimpleStatement;
import com.datastax.oss.driver.api.core.metadata.Metadata;
import com.datastax.oss.driver.api.core.metadata.schema.ColumnMetadata;
import com.datastax.oss.driver.api.core.metadata.schema.KeyspaceMetadata;
import com.datastax.oss.driver.api.core.metadata.schema.TableMetadata;
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

import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CassandraTableColumnSyncTest {

    private static final String KEYSPACE = "openframe_test";
    private static final Duration SCHEMA_CHANGE_TIMEOUT = Duration.ofSeconds(30);
    private static final CqlIdentifier SYNCED_ROWS = CqlIdentifier.fromCql("synced_rows");
    private static final String[] COLUMNS_BEFORE_THE_ADDED_ONES = {"kept_column"};
    private static final String[] ALL_COLUMNS = {"kept_column", "added_column", "other_added_column"};

    @Mock private CqlSession session;
    @Mock private Metadata metadata;
    @Mock private KeyspaceMetadata keyspace;
    @Mock private TableMetadata syncedRows;
    @Mock private ColumnMetadata column;

    @Captor private ArgumentCaptor<SimpleStatement> statementCaptor;

    private CassandraTableColumnSync sync;

    @BeforeEach
    void setUp() {
        CassandraMappingContext mappingContext = new CassandraMappingContext();
        mappingContext.setInitialEntitySet(Set.of(SyncedRow.class));
        mappingContext.afterPropertiesSet();
        MappingCassandraConverter converter = new MappingCassandraConverter(mappingContext);
        converter.afterPropertiesSet();
        SchemaFactory schemaFactory = new SchemaFactory(converter);
        sync = new CassandraTableColumnSync(session, mappingContext, schemaFactory, KEYSPACE);
    }

    @Test
    void afterSingletonsInstantiated_columnsMissing_addsEachWithIfNotExists() {
        // setup
        stubKeyspace();
        stubSyncedRows(COLUMNS_BEFORE_THE_ADDED_ONES);

        // execution
        sync.afterSingletonsInstantiated();

        // verifications
        verify(session, times(2)).execute(statementCaptor.capture());
        assertThat(statementCaptor.getAllValues())
                .extracting(SimpleStatement::getQuery)
                .containsExactlyInAnyOrder(
                        "ALTER TABLE openframe_test.synced_rows ADD IF NOT EXISTS added_column text",
                        "ALTER TABLE openframe_test.synced_rows ADD IF NOT EXISTS other_added_column text");
    }

    @Test
    void afterSingletonsInstantiated_columnAdded_usesSchemaChangeTimeout() {
        // setup
        stubKeyspace();
        stubSyncedRows(COLUMNS_BEFORE_THE_ADDED_ONES);

        // execution
        sync.afterSingletonsInstantiated();

        // verifications
        verify(session, times(2)).execute(statementCaptor.capture());
        assertThat(statementCaptor.getAllValues())
                .extracting(SimpleStatement::getTimeout)
                .containsOnly(SCHEMA_CHANGE_TIMEOUT);
    }

    @Test
    void afterSingletonsInstantiated_allColumnsPresent_altersNothing() {
        // setup
        stubKeyspace();
        stubSyncedRows(ALL_COLUMNS);

        // execution
        sync.afterSingletonsInstantiated();

        // verifications
        verify(session).getMetadata();
        verifyNoMoreInteractions(session);
    }

    @Test
    void afterSingletonsInstantiated_tableNotCreatedYet_skipsIt() {
        // setup
        stubKeyspace();
        when(keyspace.getTable(SYNCED_ROWS)).thenReturn(Optional.empty());

        // execution
        sync.afterSingletonsInstantiated();

        // verifications
        verify(session).getMetadata();
        verifyNoMoreInteractions(session);
    }

    @Test
    void afterSingletonsInstantiated_keyspaceMissingFromMetadata_skipsWithoutFailing() {
        // setup
        when(session.getMetadata()).thenReturn(metadata);
        when(metadata.getKeyspace(KEYSPACE)).thenReturn(Optional.empty());

        // execution
        sync.afterSingletonsInstantiated();

        // verifications
        verify(session).getMetadata();
        verifyNoMoreInteractions(session);
    }

    @Test
    void afterSingletonsInstantiated_alterTimesOut_startupSurvives() {
        // setup
        stubKeyspace();
        stubSyncedRows(COLUMNS_BEFORE_THE_ADDED_ONES);
        when(session.execute(any(SimpleStatement.class))).thenThrow(new DriverTimeoutException("Query timed out after PT2S"));

        // execution & verifications
        assertThatCode(() -> sync.afterSingletonsInstantiated()).doesNotThrowAnyException();
    }

    private void stubKeyspace() {
        when(session.getMetadata()).thenReturn(metadata);
        when(metadata.getKeyspace(KEYSPACE)).thenReturn(Optional.of(keyspace));
    }

    private void stubSyncedRows(String... existingColumns) {
        Map<CqlIdentifier, ColumnMetadata> columns = Stream.of(existingColumns)
                .collect(Collectors.toMap(CqlIdentifier::fromCql, existing -> column));
        when(keyspace.getTable(SYNCED_ROWS)).thenReturn(Optional.of(syncedRows));
        when(syncedRows.getColumns()).thenReturn(columns);
    }
}
