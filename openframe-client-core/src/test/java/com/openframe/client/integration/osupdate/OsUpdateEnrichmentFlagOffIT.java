package com.openframe.client.integration.osupdate;

import com.openframe.client.integration.support.OsUpdateEnrichmentTestApplication;
import com.openframe.client.scheduler.OsUpdateEnrichmentScheduler;
import com.openframe.client.service.rmm.osupdate.enrichment.CisaKevClient;
import com.openframe.client.service.rmm.osupdate.enrichment.MsrcCvrfClient;
import com.openframe.client.service.rmm.osupdate.enrichment.WindowsOsUpdateEnricher;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

import static org.assertj.core.api.Assertions.assertThat;

// The OS update flag alone does not switch the enrichment on.
@SpringBootTest(
        classes = OsUpdateEnrichmentTestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = "openframe.rmm.os-update.enabled=true")
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class OsUpdateEnrichmentFlagOffIT {

    private static final MongoDBContainer MONGO = new MongoDBContainer(DockerImageName.parse("mongo:7"));

    @Autowired private ApplicationContext context;

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        if (!MONGO.isRunning()) {
            MONGO.start();
        }
        registry.add("spring.mongodb.uri", () -> MONGO.getConnectionString() + "/test?directConnection=true");
    }

    @Test
    void enrichmentFlagMissing_noEnrichmentBean() {
        // verifications
        assertThat(context.getBeanNamesForType(OsUpdateEnrichmentScheduler.class)).isEmpty();
        assertThat(context.getBeanNamesForType(WindowsOsUpdateEnricher.class)).isEmpty();
        assertThat(context.getBeanNamesForType(MsrcCvrfClient.class)).isEmpty();
        assertThat(context.getBeanNamesForType(CisaKevClient.class)).isEmpty();
    }
}
