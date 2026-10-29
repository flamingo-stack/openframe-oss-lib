package com.openframe.data.cassandra.config;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.ResultSet;
import com.datastax.oss.driver.api.core.cql.Statement;
import com.openframe.data.cassandra.model.CassandraLogEvent;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.cassandra.core.convert.MappingCassandraConverter;
import org.springframework.data.cassandra.core.mapping.CassandraMappingContext;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CassandraSchemaInitializerTest {

    @Test
    void start_everySchemaStatement_usesTheSchemaChangeTimeout() {
        CqlSession session = mock(CqlSession.class);
        when(session.execute(any(Statement.class))).thenReturn(mock(ResultSet.class));
        CassandraMappingContext mappingContext = new CassandraMappingContext();
        mappingContext.setInitialEntitySet(Set.of(CassandraLogEvent.class));
        mappingContext.afterPropertiesSet();
        MappingCassandraConverter converter = new MappingCassandraConverter(mappingContext);
        converter.afterPropertiesSet();

        new CassandraSchemaInitializer(session, converter).start();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Statement<?>> statements = ArgumentCaptor.forClass(Statement.class);
        verify(session, atLeastOnce()).execute(statements.capture());
        assertThat(statements.getAllValues())
                .allSatisfy(statement -> assertThat(statement.getTimeout()).isEqualTo(CassandraSchemaInitializer.SCHEMA_CHANGE_TIMEOUT));
    }
}
