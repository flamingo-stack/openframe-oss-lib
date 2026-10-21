package com.openframe.event.jobs.config;

import com.openframe.event.jobs.config.properties.ReconciliationProperties;
import com.openframe.event.jobs.lock.EventJobLock;
import com.openframe.event.jobs.reconciliation.ReconciledCopy;
import com.openframe.event.jobs.scheduler.ReconciliationJob;
import com.openframe.event.jobs.service.EventJobService;
import com.openframe.event.jobs.service.EventJobTicker;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import lombok.Data;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.convert.MongoConverter;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ReconciliationConfigurationTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(ReconciliationConfiguration.class, ReconciliationPropertiesConfiguration.class)
            .withBean(MeterRegistry.class, SimpleMeterRegistry::new)
            .withBean(MongoOperations.class, ReconciliationConfigurationTest::mongoOperations)
            .withBean(EventJobService.class, () -> mock(EventJobService.class))
            .withBean(EventJobLock.class, () -> mock(EventJobLock.class))
            .withBean(EventJobTicker.class, () -> mock(EventJobTicker.class));

    @Test
    void reconciliation_isOffByDefault() {
        runner.run(context -> assertThat(context).doesNotHaveBean(ReconciliationJob.class));
    }

    @Test
    void itsSwitch_createsTheJob_forTheServicesCopies() {
        runner.withPropertyValues("openframe.events.jobs.reconciliation.enabled=true")
                .withBean("tickets", ReconciledCopy.class, () -> copy("tickets.organizationName", "organizationName"))
                .run(context -> {
                    assertThat(context).hasSingleBean(ReconciliationJob.class);
                    MeterRegistry meterRegistry = context.getBean(MeterRegistry.class);
                    assertThat(meterRegistry.find("openframe.events.reconciliation.mismatches")
                            .tag("copy", "tickets.organizationName").gauge()).isNotNull();
                });
    }

    @Test
    void twoCopiesWithOneName_stopTheService() {
        runner.withPropertyValues("openframe.events.jobs.reconciliation.enabled=true")
                .withBean("first", ReconciledCopy.class, () -> copy("tickets.organizationName", "organizationName"))
                .withBean("second", ReconciledCopy.class, () -> copy("tickets.organizationName", "organizationName"))
                .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void aCopyWithAnUnknownProperty_stopsTheService() {
        runner.withPropertyValues("openframe.events.jobs.reconciliation.enabled=true")
                .withBean("typo", ReconciledCopy.class, () -> copy("tickets.organizationName", "organisationName"))
                .run(context -> assertThat(context).hasFailed());
    }

    private static ReconciledCopy copy(String name, String targetProperty) {
        return ReconciledCopy.builder().name(name)
                .targetClass(Ticket.class).targetReferenceProperty("organizationId").targetProperty(targetProperty)
                .sourceClass(Organization.class).sourceKeyProperty("organizationId").sourceProperty("name")
                .build();
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

    @EnableConfigurationProperties(ReconciliationProperties.class)
    static class ReconciliationPropertiesConfiguration {
    }
}
