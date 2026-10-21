package com.openframe.event.jobs.reconciliation;

import lombok.Data;
import org.junit.jupiter.api.Test;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.convert.MongoConverter;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;

import java.util.function.UnaryOperator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ReconciledCopyMapperTest {

    private final ReconciledCopyMapper mapper = new ReconciledCopyMapper(mongoOperations());

    @Test
    void aCopy_resolvesToCollectionsAndStoredFieldNames() {
        // setup
        UnaryOperator<Object> lowerCase = value -> value;
        ReconciledCopy copy = ReconciledCopy.builder().name("it_tickets.orgName")
                .targetClass(Ticket.class).targetReferenceProperty("organizationId").targetProperty("organizationName")
                .sourceClass(Organization.class).sourceKeyProperty("organizationId").sourceProperty("name")
                .expectedCopy(lowerCase)
                .build();

        // execution
        MappedCopy mapped = mapper.toMappedCopy(copy);

        // verifications
        assertThat(mapped.getName()).isEqualTo("it_tickets.orgName");
        assertThat(mapped.getTargetCollection()).isEqualTo("it_tickets");
        assertThat(mapped.getTargetReferenceField()).isEqualTo("organizationId");
        assertThat(mapped.getTargetField()).isEqualTo("orgName");
        assertThat(mapped.getSourceCollection()).isEqualTo("it_organizations");
        assertThat(mapped.getSourceKeyField()).isEqualTo("organizationId");
        assertThat(mapped.getSourceField()).isEqualTo("name");
        assertThat(mapped.getExpectedCopy()).isSameAs(lowerCase);
    }

    @Test
    void anUnknownProperty_stopsTheService() {
        // setup
        ReconciledCopy typo = ReconciledCopy.builder().name("it_tickets.orgName")
                .targetClass(Ticket.class).targetReferenceProperty("organizationId").targetProperty("organisationName")
                .sourceClass(Organization.class).sourceKeyProperty("organizationId").sourceProperty("name")
                .build();

        // execution, verifications
        assertThatThrownBy(() -> mapper.toMappedCopy(typo))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("organisationName");
    }

    @Test
    void aDocumentWithoutTenant_stopsTheService() {
        // setup
        ReconciledCopy noTenant = ReconciledCopy.builder().name("it_global.orgName")
                .targetClass(GlobalRow.class).targetReferenceProperty("organizationId").targetProperty("organizationName")
                .sourceClass(Organization.class).sourceKeyProperty("organizationId").sourceProperty("name")
                .build();

        // execution, verifications
        assertThatThrownBy(() -> mapper.toMappedCopy(noTenant))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("tenantId");
    }

    private static MongoOperations mongoOperations() {
        MongoOperations mongoOperations = mock(MongoOperations.class);
        MongoConverter converter = mock(MongoConverter.class);
        MongoMappingContext mappingContext = new MongoMappingContext();
        doReturn(mappingContext).when(converter).getMappingContext();
        when(mongoOperations.getConverter()).thenReturn(converter);
        return mongoOperations;
    }

    @Data
    @Document("it_tickets")
    static class Ticket {
        @Id
        private String id;
        private String tenantId;
        private String organizationId;
        @Field("orgName")
        private String organizationName;
    }

    @Data
    @Document("it_organizations")
    static class Organization {
        @Id
        private String id;
        private String tenantId;
        private String organizationId;
        private String name;
    }

    @Data
    @Document("it_global")
    static class GlobalRow {
        @Id
        private String id;
        private String organizationId;
        private String organizationName;
    }
}
